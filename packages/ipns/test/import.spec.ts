import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { localStore } from '../src/local-store.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { IPNSPublishMetadata, Upkeep } from '../src/pb/metadata.ts'
import { createIPNSRecord } from '../src/records.ts'
import { decodeExtensibleData, ipnsMetadataKey, multihashToIPNSRoutingKey } from '../src/utils.ts'
import { createIPNS } from './fixtures/create-ipns.ts'
import type { IPNS } from '../src/ipns.ts'
import type { CreateIPNSResult } from './fixtures/create-ipns.ts'

const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('import', () => {
  let name: IPNS
  let result: CreateIPNSResult

  beforeEach(async () => {
    result = await createIPNS()
    name = result.name
  })

  it('stores a valid record locally without publishing to the routers', async () => {
    const key = await result.keychain.generateKey('test-key')
    const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
    const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

    await name.import(key.publicKey, record)

    const store = localStore(result.datastore, result.log)
    expect(await store.has(routingKey)).to.be.true('record was not stored locally')
    // no metadata written - dormant until republish gives it a policy
    expect(await result.datastore.has(ipnsMetadataKey(routingKey))).to.be.false('import wrote metadata')
    // never touches the network
    expect(result.customRouting.put.called).to.be.false('import published to custom routing')
    expect(result.heliaRouting.put.called).to.be.false('import published to Helia routing')
  })

  it('throws RecordObsoleteError when a newer record is already stored', async () => {
    const key = await result.keychain.generateKey('test-key')
    const older = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
    const newer = await createIPNSRecord(key, `/ipfs/${testCid}`, 5n, 24 * 60 * 60 * 1000)

    await name.import(key.publicKey, newer)

    const err = await expect(name.import(key.publicKey, older)).to.eventually.be.rejected()

    expect(err).to.have.property('name', 'RecordObsoleteError')
    // the attached record is the more suitable one that is already stored
    expect(IPNSEntry.encode(err.record)).to.deep.equal(IPNSEntry.encode(newer))
  })

  it('does not throw when re-importing an equally suitable record', async () => {
    const key = await result.keychain.generateKey('test-key')
    const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
    const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

    await name.import(key.publicKey, record)

    const store = localStore(result.datastore, result.log)
    const before = (await store.get(routingKey)).record

    // re-importing the same record is a tie, not an obsolete record, so it is
    // idempotent and does not throw
    await name.import(key.publicKey, record)

    expect((await store.get(routingKey)).record).to.deep.equal(before)
  })

  it('throws a validation error when the record is invalid', async () => {
    const key = await result.keychain.generateKey('test-key')
    // an expired record fails validation
    const expired = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, -60_000)

    await expect(name.import(key.publicKey, expired)).to.eventually.be.rejected
      .with.property('name', 'RecordExpiredError')
  })

  it('overwrites a less-suitable stored record and preserves its upkeep metadata', async () => {
    const key = await result.keychain.generateKey('test-key')
    const older = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
    const newer = await createIPNSRecord(key, `/ipfs/${testCid}`, 5n, 24 * 60 * 60 * 1000)
    const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

    // the older record is stored with a full upkeep policy, as publish would
    const store = localStore(result.datastore, result.log)
    await store.put(routingKey, IPNSEntry.encode(older), {
      metadata: { keyName: 'test-key', lifetime: 1234, upkeep: Upkeep.reissue }
    })

    // importing the newer record overwrites the stored one
    await name.import(key.publicKey, newer)
    const { record: storedBytes } = await store.get(routingKey)
    expect(decodeExtensibleData(IPNSEntry.decode(storedBytes).data).Sequence).to.equal(5n, 'did not overwrite with the newer record')

    // the key's upkeep policy is untouched, so it keeps being republished automatically
    const metadata = IPNSPublishMetadata.decode(await result.datastore.get(ipnsMetadataKey(routingKey)))
    expect(metadata.keyName).to.equal('test-key')
    expect(metadata.lifetime).to.equal(1234)
    expect(metadata.upkeep).to.equal(Upkeep.reissue)
  })

  it('accepts a marshalled record as bytes', async () => {
    const key = await result.keychain.generateKey('test-key')
    const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
    const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

    // delegated-routing clients commonly hand back marshalled bytes
    await name.import(key.publicKey, IPNSEntry.encode(record))

    const store = localStore(result.datastore, result.log)
    expect(await store.has(routingKey)).to.be.true('marshalled record was not stored')
  })
})
