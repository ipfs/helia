import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { localStore } from '../src/local-store.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { IPNSPublishMetadata, Upkeep } from '../src/pb/metadata.ts'
import { createIPNSRecord } from '../src/records.ts'
import { ipnsMetadataKey, multihashToIPNSRoutingKey } from '../src/utils.ts'
import { createIPNS } from './fixtures/create-ipns.ts'
import type { LocalStore } from '../src/local-store.ts'
import type { CreateIPNSResult } from './fixtures/create-ipns.ts'

const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('local-store', () => {
  let result: CreateIPNSResult
  let store: LocalStore

  beforeEach(async () => {
    result = await createIPNS()
    store = localStore(result.datastore, result.log)
  })

  describe('metadata keyName guard', () => {
    it('rejects reissue upkeep without a keyName', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // reissue upkeep re-signs the record, which needs the key, so a keyName
      // is required
      await expect(store.put(routingKey, IPNSEntry.encode(record), {
        metadata: { upkeep: Upkeep.reissue }
      })).to.eventually.be.rejectedWith('a keyName is required to reissue a record')
    })

    it('allows reissue upkeep when a keyName is present', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: { keyName: 'test-key', upkeep: Upkeep.reissue }
      })

      expect(await store.has(routingKey)).to.be.true()
    })

    it('allows rebroadcast upkeep without a keyName', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // rebroadcast upkeep only re-broadcasts the existing record, so no key is needed
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: { upkeep: Upkeep.rebroadcast }
      })

      expect(await store.has(routingKey)).to.be.true()
    })
  })

  describe('metadata merge', () => {
    it('preserves keyName and lifetime on a partial upkeep-only update', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // a previously-published record carries keyName + lifetime
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: { keyName: 'test-key', lifetime: 1234 }
      })

      // a partial update setting only upkeep must preserve keyName + lifetime
      await store.put(routingKey, IPNSEntry.encode(record), {
        overwrite: true,
        metadata: { upkeep: Upkeep.rebroadcast }
      })

      const metadata = IPNSPublishMetadata.decode(await result.datastore.get(ipnsMetadataKey(routingKey)))
      expect(metadata.keyName).to.equal('test-key')
      expect(metadata.lifetime).to.equal(1234)
      expect(metadata.upkeep).to.equal(Upkeep.rebroadcast)
    })

    it('rejects a partial update when the existing metadata is unreadable', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      await store.put(routingKey, IPNSEntry.encode(record))
      // corrupt the stored metadata bytes so they cannot be decoded
      await result.datastore.put(ipnsMetadataKey(routingKey), Uint8Array.from([0x0a, 0xff, 0xff, 0xff, 0xff]))

      // a partial update must surface the corruption, not silently overwrite it
      await expect(store.put(routingKey, IPNSEntry.encode(record), {
        overwrite: true,
        metadata: { upkeep: Upkeep.rebroadcast }
      })).to.eventually.be.rejected()
    })
  })
})
