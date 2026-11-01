import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { localStore } from '../src/local-store.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { IPNSPublishMetadata, Upkeep } from '../src/pb/metadata.ts'
import { createIPNSRecord } from '../src/records.ts'
import { decodeExtensibleData, dhtRoutingKey, ipnsMetadataKey, multihashToIPNSRoutingKey } from '../src/utils.ts'
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

  describe('concurrent writes', () => {
    it('does not replace a newer record with an older record', async () => {
      const key = await result.keychain.generateKey('test-key')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
      const cachedRecord = await createIPNSRecord(key, '/cached', 3n, 24 * 60 * 60 * 1000)
      const newerRecord = await createIPNSRecord(key, '/newer', 5n, 24 * 60 * 60 * 1000)
      const olderRecord = await createIPNSRecord(key, '/older', 4n, 24 * 60 * 60 * 1000)
      const datastoreKey = dhtRoutingKey(routingKey).toString()
      const secondStore = localStore(result.datastore, result.log)
      const originalGet = result.datastore.get.bind(result.datastore)
      let releaseGets!: () => void
      let firstGetStartedResolve!: () => void
      const release = new Promise<void>(resolve => { releaseGets = resolve })
      const firstGetStarted = new Promise<void>(resolve => { firstGetStartedResolve = resolve })

      await store.put(routingKey, IPNSEntry.encode(cachedRecord))

      Sinon.stub(result.datastore, 'get').callsFake(async (key, options) => {
        const value = await originalGet(key, options)

        if (key.toString() === datastoreKey) {
          firstGetStartedResolve()
          await release
        }

        return value
      })

      const newerPut = store.put(routingKey, IPNSEntry.encode(newerRecord))
      await firstGetStarted

      const olderPut = secondStore.put(routingKey, IPNSEntry.encode(olderRecord))

      // Without the lock, the second writer's callback is already queued and
      // captures sequence 3 before this gate opens. With the lock, its callback
      // cannot run until the first writer has committed sequence 5.
      queueMicrotask(releaseGets)

      const [, olderResult] = await Promise.all([newerPut, olderPut])

      expect(olderResult.status).to.equal('rejected')
      expect(olderResult.record).to.equalBytes(IPNSEntry.encode(newerRecord))

      const { record } = await store.get(routingKey)
      const data = decodeExtensibleData(IPNSEntry.decode(record).data)

      expect(data.Sequence).to.equal(5n)
      expect(data.Value).to.equalBytes(new TextEncoder().encode('/newer'))
    })

    it('continues queued writes after an earlier write fails', async () => {
      const key = await result.keychain.generateKey('test-key')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
      const cachedRecord = await createIPNSRecord(key, '/cached', 1n, 24 * 60 * 60 * 1000)
      const validRecord = await createIPNSRecord(key, '/valid', 2n, 24 * 60 * 60 * 1000)
      const secondStore = localStore(result.datastore, result.log)

      await store.put(routingKey, IPNSEntry.encode(cachedRecord))

      const results = await Promise.allSettled([
        store.put(routingKey, new TextEncoder().encode('invalid record')),
        secondStore.put(routingKey, IPNSEntry.encode(validRecord))
      ])

      expect(results[0].status).to.equal('rejected')
      expect(results[1].status).to.equal('fulfilled')

      const { record } = await store.get(routingKey)
      const data = decodeExtensibleData(IPNSEntry.decode(record).data)

      expect(data.Sequence).to.equal(2n)
      expect(data.Value).to.equalBytes(new TextEncoder().encode('/valid'))
    })

    it('aborts a queued caller without allowing later writes to bypass the lock', async () => {
      const key = await result.keychain.generateKey('test-key')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
      const firstRecord = await createIPNSRecord(key, '/first', 1n, 24 * 60 * 60 * 1000)
      const abortedRecord = await createIPNSRecord(key, '/aborted', 2n, 24 * 60 * 60 * 1000)
      const finalRecord = await createIPNSRecord(key, '/final', 3n, 24 * 60 * 60 * 1000)
      const datastoreKey = dhtRoutingKey(routingKey).toString()
      const secondStore = localStore(result.datastore, result.log)
      const originalGet = result.datastore.get.bind(result.datastore)
      const controller = new AbortController()
      let getCalls = 0
      let releaseFirstGet!: () => void
      let firstGetStartedResolve!: () => void
      const releaseFirst = new Promise<void>(resolve => { releaseFirstGet = resolve })
      const firstGetStarted = new Promise<void>(resolve => { firstGetStartedResolve = resolve })

      Sinon.stub(result.datastore, 'get').callsFake(async (key, options) => {
        if (key.toString() === datastoreKey && getCalls++ === 0) {
          firstGetStartedResolve()
          await releaseFirst
        }

        return originalGet(key, options)
      })

      const firstPut = store.put(routingKey, IPNSEntry.encode(firstRecord))
      await firstGetStarted

      const abortedPut = secondStore.put(routingKey, IPNSEntry.encode(abortedRecord), {
        signal: controller.signal
      })
      controller.abort()

      try {
        await expect(abortedPut).to.eventually.be.rejected
          .with.property('name', 'AbortError')
      } finally {
        releaseFirstGet()
        await firstPut
      }

      await secondStore.put(routingKey, IPNSEntry.encode(finalRecord))

      const { record } = await store.get(routingKey)
      const data = decodeExtensibleData(IPNSEntry.decode(record).data)

      expect(data.Sequence).to.equal(3n)
      expect(data.Value).to.equalBytes(new TextEncoder().encode('/final'))
    })

    it('processes writes for different routing keys concurrently', async () => {
      const firstKey = await result.keychain.generateKey('first-key')
      const secondKey = await result.keychain.generateKey('second-key')
      const firstRoutingKey = multihashToIPNSRoutingKey(firstKey.publicKey.toMultihash())
      const secondRoutingKey = multihashToIPNSRoutingKey(secondKey.publicKey.toMultihash())
      const firstRecord = await createIPNSRecord(firstKey, '/first', 1n, 24 * 60 * 60 * 1000)
      const secondRecord = await createIPNSRecord(secondKey, '/second', 1n, 24 * 60 * 60 * 1000)
      const firstDatastoreKey = dhtRoutingKey(firstRoutingKey).toString()
      const originalGet = result.datastore.get.bind(result.datastore)
      let releaseFirstGet!: () => void
      let firstGetStartedResolve!: () => void
      const releaseFirst = new Promise<void>(resolve => { releaseFirstGet = resolve })
      const firstGetStarted = new Promise<void>(resolve => { firstGetStartedResolve = resolve })

      Sinon.stub(result.datastore, 'get').callsFake(async (key, options) => {
        if (key.toString() === firstDatastoreKey) {
          firstGetStartedResolve()
          await releaseFirst
        }

        return originalGet(key, options)
      })

      const firstPut = store.put(firstRoutingKey, IPNSEntry.encode(firstRecord))
      await firstGetStarted

      await store.put(secondRoutingKey, IPNSEntry.encode(secondRecord))
      expect(await store.has(secondRoutingKey)).to.be.true()

      releaseFirstGet()
      await firstPut
    })
  })
})
