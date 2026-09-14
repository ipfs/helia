import { ed25519Crypto } from '@ipshipyard/crypto'
import { NotFoundError, start, stop } from '@libp2p/interface'
import { Record } from '@libp2p/kad-dht'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import sinon from 'sinon'
import NanoDate from 'timestamp-nano'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { REPUBLISH_THRESHOLD } from '../src/constants.ts'
import { localStore } from '../src/local-store.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { IPNSPublishMetadata, Upkeep } from '../src/pb/metadata.ts'
import { createIPNSRecord } from '../src/records.ts'
import { decodeExtensibleData, dhtRoutingKey, ipnsMetadataKey, multihashFromIPNSRoutingKey, multihashToIPNSRoutingKey } from '../src/utils.ts'
import { createIPNS } from './fixtures/create-ipns.ts'
import type { IPNS } from '../src/ipns.ts'
import type { CreateIPNSResult } from './fixtures/create-ipns.ts'
import type { Key } from 'interface-datastore'

// Helper to await until a stub is called
function waitForStubCall (stub: sinon.SinonStub, callCount = 1): Promise<void> {
  return new Promise((resolve) => {
    const check = (): void => {
      if (stub.callCount >= callCount) {
        resolve()
      } else {
        setTimeout(check, 1)
      }
    }
    check()
  })
}

// shorten the default validity so we are always within the republish window
const SHORTENED_VALIDITY = 2 * 60 * 60 * 1000

describe('republisher', () => {
  const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  let name: IPNS
  let result: CreateIPNSResult
  let putStubCustom: sinon.SinonStub<[Key, Uint8Array]>
  let putStubHelia: sinon.SinonStub

  beforeEach(async () => {
    result = await createIPNS()
    name = result.name

    // Stub the routers by default
    putStubCustom = sinon.stub<[Key, Uint8Array]>().resolves()
    putStubHelia = sinon.stub().resolves()
    // @ts-ignore
    result.customRouting.put = putStubCustom
    // @ts-ignore
    result.heliaRouting.put = putStubHelia
  })

  afterEach(async () => {
    await stop(name)
    sinon.restore()
    sinon.reset()
  })

  describe('basic functionality', () => {
    it('should start republishing when called', async () => {
      // Import the key into the real keychain
      const key = await result.keychain.generateKey('test-key')

      // Create a test record and store it in the real datastore
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore using the localStore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      // Start republishing
      await start(name)
      await waitForStubCall(putStubCustom)

      // Only check custom router for most tests
      expect(putStubCustom.called).to.be.true()
    })

    it('should call all routers for republish', async () => {
      // Create a test record and store it in the real datastore
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore using the localStore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await Promise.all([
        waitForStubCall(putStubCustom),
        waitForStubCall(putStubHelia),

        // Start republishing
        start(name)
      ])

      // Check both routers
      expect(putStubCustom.called).to.be.true()
      expect(putStubHelia.called).to.be.true()
      expect(putStubCustom.firstCall.args[0]).to.deep.equal(routingKey)
      expect(putStubHelia.firstCall.args[0]).to.deep.equal(routingKey)
    })

    it('should republish records with valid metadata', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      // Start publishing
      await start(name)
      await waitForStubCall(putStubCustom)

      // Verify the record was republished with incremented sequence
      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      expect(callArgs[0]).to.deep.equal(routingKey)

      const republishedRecord = IPNSEntry.decode(callArgs[1])
      expect(decodeExtensibleData(republishedRecord.data).Sequence).to.equal(2n) // Incremented from 1n
    })

    it('should republish existing records', async () => {
      const key = await ed25519Crypto().generatePrivateKey()
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // create a dht record with a timeReceived < now - REPUBLISH_THRESHOLD
      const timeReceived = new Date(Date.now() - REPUBLISH_THRESHOLD - 60 * 60 * 1000)
      const dhtRecord = new Record(routingKey, IPNSEntry.encode(record), timeReceived)

      // Store the dht record and metadata in the real datastore
      await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())
      await result.datastore.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode({ upkeep: Upkeep.rebroadcast }))

      // Start publishing
      await start(name)
      await waitForStubCall(putStubCustom)

      // Verify the existing record was republished unchanged (rebroadcast)
      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      expect(callArgs[0]).to.deep.equal(routingKey)

      const republishedRecord = IPNSEntry.decode(callArgs[1])
      expect(decodeExtensibleData(republishedRecord.data).Sequence).to.equal(1n)
    })

    it('should re-stamp the created date when rebroadcasting', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // store the dht record with an old timeReceived so it is due for rebroadcast
      const oldTimeReceived = new Date(Date.now() - REPUBLISH_THRESHOLD - 60 * 60 * 1000)
      const dhtRecord = new Record(routingKey, IPNSEntry.encode(record), oldTimeReceived)
      await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())
      await result.datastore.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode({ upkeep: Upkeep.rebroadcast }))

      await start(name)
      await waitForStubCall(putStubCustom)

      // the rebroadcast puts to the local store with overwrite: true, re-stamping
      // created to ~now; without it the loop would re-select this record every cycle
      const store = localStore(result.datastore, result.log)
      let created = (await store.get(routingKey)).created
      for (let i = 0; i < 50 && created.getTime() <= oldTimeReceived.getTime(); i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
        created = (await store.get(routingKey)).created
      }
      expect(created.getTime()).to.be.greaterThan(oldTimeReceived.getTime())
    })

    it('should persist the reissued record locally so it is not re-selected next cycle', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // store the dht record with an old timeReceived so it is due for reissue
      const oldTimeReceived = new Date(Date.now() - REPUBLISH_THRESHOLD - 60 * 60 * 1000)
      const dhtRecord = new Record(routingKey, IPNSEntry.encode(record), oldTimeReceived)
      await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())
      await result.datastore.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode({ keyName: 'test-key', lifetime: 24 * 60 * 60 * 1000, upkeep: Upkeep.reissue }))

      await start(name)
      await waitForStubCall(putStubCustom)

      // the reissued record (seq 2) must persist locally with a fresh created,
      // otherwise the loop would reissue it (bumping the sequence) every cycle
      const store = localStore(result.datastore, result.log)
      let stored = await store.get(routingKey)
      for (let i = 0; i < 50 && decodeExtensibleData(IPNSEntry.decode(stored.record).data).Sequence !== 2n; i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
        stored = await store.get(routingKey)
      }
      expect(decodeExtensibleData(IPNSEntry.decode(stored.record).data).Sequence).to.equal(2n, 'reissued record was not persisted')
      expect(stored.created.getTime()).to.be.greaterThan(oldTimeReceived.getTime(), 'created was not re-stamped')
    })

    it('should adopt a newer record from the network when rebroadcasting', async () => {
      const key = await result.keychain.generateKey('test-key')
      const localRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // the routers serve a newer record than the one we hold locally
      const routerRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 5n, 24 * 60 * 60 * 1000)
      const getStubCustom = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
      const getStubHelia = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
      // @ts-ignore
      result.customRouting.get = getStubCustom
      // @ts-ignore
      result.heliaRouting.get = getStubHelia

      // store the dht record with a timeReceived old enough that it is due for refresh
      const timeReceived = new Date(Date.now() - REPUBLISH_THRESHOLD - 60 * 60 * 1000)
      const dhtRecord = new Record(routingKey, IPNSEntry.encode(localRecord), timeReceived)
      await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())
      await result.datastore.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode({ upkeep: Upkeep.rebroadcast }))

      await start(name)
      await waitForStubCall(putStubCustom)

      // the loop resolves the routers and re-broadcasts the newer record, not the stale local one
      expect(getStubCustom.called).to.be.true()
      const republished = IPNSEntry.decode(putStubCustom.firstCall.args[1])
      expect(decodeExtensibleData(republished.data).Sequence).to.equal(5n)

      // the adopted record must persist to the local store so it is served
      // afterwards, and its rebroadcast metadata must survive so future cycles
      // keep rebroadcasting it
      const store = localStore(result.datastore, result.log)
      let storedSeq = decodeExtensibleData(IPNSEntry.decode((await store.get(routingKey)).record).data).Sequence
      for (let i = 0; i < 50 && storedSeq !== 5n; i++) {
        await new Promise(resolve => setTimeout(resolve, 10))
        storedSeq = decodeExtensibleData(IPNSEntry.decode((await store.get(routingKey)).record).data).Sequence
      }
      expect(storedSeq).to.equal(5n, 'the adopted record was not persisted to the local store')

      const metadata = IPNSPublishMetadata.decode(await result.datastore.get(ipnsMetadataKey(routingKey)))
      expect(metadata.upkeep).to.equal(Upkeep.rebroadcast, 'rebroadcast metadata was lost when adopting the newer record')
    })

    it('should keep the local record when the network has only an older one', async () => {
      const key = await result.keychain.generateKey('test-key')
      const localRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 2n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // the routers serve an older record than the one we hold locally
      const routerRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const getStubCustom = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
      const getStubHelia = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
      // @ts-ignore
      result.customRouting.get = getStubCustom
      // @ts-ignore
      result.heliaRouting.get = getStubHelia

      // store the dht record with a timeReceived old enough that it is due for rebroadcast
      const timeReceived = new Date(Date.now() - REPUBLISH_THRESHOLD - 60 * 60 * 1000)
      const dhtRecord = new Record(routingKey, IPNSEntry.encode(localRecord), timeReceived)
      await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())
      await result.datastore.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode({ upkeep: Upkeep.rebroadcast }))

      await start(name)
      await waitForStubCall(putStubCustom)

      // the loop must not downgrade to the older network record
      expect(getStubCustom.called).to.be.true()
      const republished = IPNSEntry.decode(putStubCustom.firstCall.args[1])
      expect(decodeExtensibleData(republished.data).Sequence).to.equal(2n)
    })
  })

  describe('record processing', () => {
    it('should skip records without metadata', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record without metadata (simulate old records)
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record)) // No metadata

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // Verify no records were republished
      expect(putStubCustom.called).to.be.false()
    })

    it('should skip records with republishing disabled', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record without metadata (simulate old records)
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          upkeep: Upkeep.none
        }
      })

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // Verify no records were republished
      expect(putStubCustom.called).to.be.false()
    })

    it('should handle invalid records gracefully', async () => {
      const routingKey = new Uint8Array([1, 2, 3, 4])

      // Store an invalid record in the datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, new Uint8Array([255, 255, 255]), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // Verify no records were republished due to error
      expect(putStubCustom.called).to.be.false()
    })

    it('should increment sequence numbers correctly', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 5n, SHORTENED_VALIDITY) // Start with sequence 5
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY,
          upkeep: Upkeep.reissue
        }
      })

      await start(name)
      await waitForStubCall(putStubCustom)

      expect(putStubCustom.called).to.be.true()

      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = IPNSEntry.decode(callArgs[1])
      expect(decodeExtensibleData(republishedRecord.data).Sequence).to.equal(6n) // Incremented from 5n
    })

    it('should skip republishing existing records created within republish threshold', async () => {
      const key = await result.keychain.generateKey('test-key')
      // long validity + freshly created, so it is not within the republish threshold
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 48 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore using the localStore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          upkeep: Upkeep.rebroadcast
        }
      })

      // Start publishing
      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // Should not republish since the record is still within the refresh threshold
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })
  })

  describe('TTL and lifetime', () => {
    it('should use existing TTL from records', async () => {
      const key = await result.keychain.generateKey('test-key')
      const customTtl = BigInt(10 * 60 * 1000) * 1_000_000n // 10 minutes in nanoseconds
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY, { ttlNs: customTtl })
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await start(name)
      await waitForStubCall(putStubCustom)

      // Verify the record was republished with incremented sequence
      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      expect(callArgs[0]).to.deep.equal(routingKey)

      const republishedRecord = IPNSEntry.decode(callArgs[1])
      expect(decodeExtensibleData(republishedRecord.data).Sequence).to.equal(2n) // Incremented from 1n
      expect(republishedRecord.ttl).to.equal(customTtl)
    })

    it('should use default TTL when not present', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await start(name)
      await waitForStubCall(putStubCustom)

      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = IPNSEntry.decode(callArgs[1])
      expect(republishedRecord.ttl).to.equal(5n * 60n * 1000n * 1_000_000n) // Default TTL
    })

    it('should use metadata lifetime', async () => {
      const key = await result.keychain.generateKey('test-key')
      const customLifetime = 5 * 1000 // 5 seconds
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, customLifetime)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: customLifetime
        }
      })

      await start(name)
      await waitForStubCall(putStubCustom)

      const expectedValidity = Date.now() + customLifetime

      expect(putStubCustom.called).to.be.true()

      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = IPNSEntry.decode(callArgs[1])

      // Check that the validity is set to the custom lifetime
      const actualValidity = new Date(uint8ArrayToString(decodeExtensibleData(republishedRecord.data).Validity))

      const timeDiff = Math.abs(actualValidity.getTime() - expectedValidity)
      expect(timeDiff).to.be.lessThan(200)
    })
  })

  describe('error handling', () => {
    it('should skip republishing records with missing key', async () => {
      const key = await result.keychain.generateKey('test-key')
      const record = await createIPNSRecord(key, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore (but don't import the key)
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          keyName: 'missing-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      // the record is only skipped after the key lookup fails, so gate on that
      // lookup rather than a fixed delay that could outrun the async work
      const exportKeySpy = sinon.spy(result.keychain, 'exportKey')

      await start(name)
      await waitForStubCall(exportKeySpy as any)

      // Should not republish due to keychain error (key not found)
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should handle localStore.list() errors during republish', async () => {
      // Stub localStore to throw error during list operation
      const store = localStore(result.datastore, result.log)
      const listStub = sinon.stub(store, 'list').throws(new Error('Datastore list failed'))

      // Override the localStore on the IPNS instance
      // @ts-ignore
      name.localStore = name['republisher']['localStore'] = store

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      expect(listStub.called).to.be.true()
      // Should not republish due to list error
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should handle corrupt record data during republish iteration', async () => {
      const key = await result.keychain.generateKey('test-key')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      const store = localStore(result.datastore, result.log)

      // Store corrupt record data that will fail to unmarshal
      await store.put(routingKey, new Uint8Array([255, 255, 255]), {
        metadata: {
          keyName: 'test-key',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // Should not republish due to unmarshal error
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should not rebroadcast an expired record', async () => {
      const key = await result.keychain.generateKey('test-key')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // a record whose validity is already in the past
      const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, -60_000)
      expect(NanoDate.fromString(uint8ArrayToString(decodeExtensibleData(record.data).Validity)).getTimeT() * 1_000)
        .to.be.lessThan(Date.now(), 'record was not expired')

      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, IPNSEntry.encode(record), {
        metadata: {
          upkeep: Upkeep.rebroadcast
        }
      })

      await start(name)
      await new Promise(resolve => setTimeout(resolve, 20))

      // rebroadcast has no key to re-sign with, so an expired record cannot be
      // revived and must be skipped rather than re-published as-is
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should continue republishing other records when one record fails', async () => {
      const key1 = await result.keychain.generateKey('test-key-1')
      const key2 = await result.keychain.generateKey('test-key-2')
      const record2 = await createIPNSRecord(key2, `/ipfs/${testCid.toV1()}`, 1n, SHORTENED_VALIDITY)
      const routingKey1 = multihashToIPNSRoutingKey(key1.publicKey.toMultihash())
      const routingKey2 = multihashToIPNSRoutingKey(key2.publicKey.toMultihash())

      const store = localStore(result.datastore, result.log)

      // Store one valid record and one corrupt record
      await store.put(routingKey1, new Uint8Array([255, 255, 255]), {
        metadata: {
          keyName: 'test-key-1',
          lifetime: SHORTENED_VALIDITY
        }
      })
      await store.put(routingKey2, IPNSEntry.encode(record2), {
        metadata: {
          keyName: 'test-key-2',
          lifetime: SHORTENED_VALIDITY
        }
      })

      await start(name)
      await waitForStubCall(putStubCustom)

      // Should republish the valid record despite the corrupt one
      expect(putStubCustom.called).to.be.true()
      expect(putStubHelia.called).to.be.true()

      // only the valid record (key2) is republished, reissued to seq 2
      expect(putStubCustom.firstCall.args[0]).to.deep.equal(routingKey2)
      expect(decodeExtensibleData(IPNSEntry.decode(putStubCustom.firstCall.args[1]).data).Sequence).to.equal(2n)
    })
  })

  describe('republish() method', () => {
    let getStubCustom: sinon.SinonStub
    let getStubHelia: sinon.SinonStub

    beforeEach(async () => {
      result = await createIPNS()
      name = result.name

      // Stub the routers by default to reject
      getStubCustom = sinon.stub().rejects()
      getStubHelia = sinon.stub().rejects()
      // @ts-ignore
      result.customRouting.get = getStubCustom
      // @ts-ignore
      result.heliaRouting.get = getStubHelia
    })

    describe('basic functionality', () => {
      it('should lookup latest record in cache and in routers', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // Store the record in the real datastore
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // @ts-ignore
        const storeGetSpy = sinon.spy(name.localStore, 'get')

        await name.republish(multihashFromIPNSRoutingKey(routingKey))

        expect(storeGetSpy.called).to.be.true()
        expect(getStubCustom.called).to.be.true()
        expect(getStubHelia.called).to.be.true()
      })

      it('should write to metadata', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        await name.republish(multihashFromIPNSRoutingKey(routingKey))

        const metadataBuf = await result.datastore.get(ipnsMetadataKey(routingKey))
        const metadata = IPNSPublishMetadata.decode(metadataBuf)
        expect(metadata.upkeep).to.equal(Upkeep.rebroadcast)
      })

      it('should preserve existing keyName and lifetime when updating metadata', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // a previously-published record carries keyName + lifetime in its metadata
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record), {
          metadata: { keyName: 'test-key', lifetime: 1234 }
        })

        await name.republish(multihashFromIPNSRoutingKey(routingKey), { upkeep: 'rebroadcast' })

        // republish only sets upkeep - keyName and lifetime must be preserved, not wiped
        const metadata = IPNSPublishMetadata.decode(await result.datastore.get(ipnsMetadataKey(routingKey)))
        expect(metadata.upkeep).to.equal(Upkeep.rebroadcast)
        expect(metadata.keyName).to.equal('test-key')
        expect(metadata.lifetime).to.equal(1234)
      })

      it('decodes metadata with no upkeep field as reissue (back-compat)', () => {
        // records published before the upkeep field existed carry only keyName + lifetime;
        // they must decode to the reissue policy so the upgrade path keeps re-signing them
        const buf = IPNSPublishMetadata.encode({ keyName: 'test-key', lifetime: 1234 })
        expect(IPNSPublishMetadata.decode(buf).upkeep).to.equal(Upkeep.reissue)
      })

      it('should accept an IPNS name string and reject a keychain key name', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // republish operates on the record's identity, so it takes an IPNS name
        const republished = await name.republish(key.publicKey.toCID().toString())
        expect(republished.record.value).to.deep.equal(record.value)

        // a keychain key name is not an IPNS name and is rejected
        await expect(name.republish('test-key')).to.eventually.be.rejected
          .with.property('name', 'InvalidValueError')
      })

      it('should round-trip the upkeep option through metadata', async () => {
        const cases: Array<'rebroadcast' | 'none'> = ['rebroadcast', 'none']

        for (const upkeep of cases) {
          const key = await result.keychain.generateKey(`test-key-${upkeep}`)
          const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
          const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

          const store = localStore(result.datastore, result.log)
          await store.put(routingKey, IPNSEntry.encode(record))

          await name.republish(multihashFromIPNSRoutingKey(routingKey), {
            upkeep
          })

          const metadataBuf = await result.datastore.get(ipnsMetadataKey(routingKey))
          expect(IPNSPublishMetadata.decode(metadataBuf).upkeep).to.equal(Upkeep[upkeep])
        }
      })

      it('should overwrite the created date on the dht record', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // store the record with an old timeReceived so a re-stamp is detectable
        const oldCreated = new Date(Date.now() - 60 * 60 * 1000)
        const dhtRecord = new Record(routingKey, IPNSEntry.encode(record), oldCreated)
        await result.datastore.put(dhtRoutingKey(routingKey), dhtRecord.serialize())

        await name.republish(multihashFromIPNSRoutingKey(routingKey))

        const store = localStore(result.datastore, result.log)
        const { created: newCreated } = await store.get(routingKey)

        // republish re-stamps created to ~now
        expect(newCreated.getTime()).to.be.greaterThan(oldCreated.getTime())
      })

      it('should skip router resolution and publish local record to routers when skipResolution is set', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record1 = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const record2 = await createIPNSRecord(key, `/ipfs/${testCid}`, 2n, 24 * 60 * 60 * 1000)
        const record3 = await createIPNSRecord(key, `/ipfs/${testCid}`, 3n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // Store the record in the real datastore
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record1))

        // Stub router GETs - should never be called when skipResolution is set
        getStubCustom = sinon.stub().resolves(IPNSEntry.encode(record2))
        getStubHelia = sinon.stub().resolves(IPNSEntry.encode(record3))
        // @ts-ignore
        result.customRouting.get = getStubCustom
        // @ts-ignore
        result.heliaRouting.get = getStubHelia

        // @ts-ignore
        const storePutSpy = sinon.spy(name.localStore, 'put')

        const republished = await name.republish(multihashFromIPNSRoutingKey(routingKey), {
          skipResolution: true
        })

        expect(storePutSpy.called).to.be.true()
        expect(getStubCustom.called).to.be.false()
        expect(getStubHelia.called).to.be.false()
        expect(result.customRouting.put.called).to.be.true()
        expect(result.heliaRouting.put.called).to.be.true()
        expect(decodeExtensibleData(republished.record.data).Sequence).to.equal(1n)
      })

      it('should publish a valid local record when no records are found in the routing', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // Store the record in the real datastore
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // Stub router GETs to not find any records
        result.customRouting.get = sinon.stub<any>().rejects(new NotFoundError())
        result.heliaRouting.get = sinon.stub<any>().rejects(new NotFoundError())

        // @ts-expect-error localStore property is private
        const localStorePutSpy = sinon.spy(name.localStore, 'put')

        const republished = await name.republish(multihashFromIPNSRoutingKey(routingKey))

        expect(localStorePutSpy.called).to.be.true('did not re-stamp the local record on republish')
        expect(result.customRouting.put.called).to.be.true('did not publish cached record')
        expect(result.heliaRouting.put.called).to.be.true('did not publish cached record')
        expect(decodeExtensibleData(republished.record.data).Sequence).to.equal(1n)
        expect(republished.publicKey.toCID().equals(key.publicKey.toCID())).to.be.true('did not return the record public key')
      })

      it('should forward onProgress to the routers so routing events reach the caller', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // hold a local record to republish, with nothing newer in the routing
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))
        result.customRouting.get = sinon.stub<any>().rejects(new NotFoundError())
        result.heliaRouting.get = sinon.stub<any>().rejects(new NotFoundError())

        // a router that emits a routing progress event as it publishes
        const event = new CustomProgressEvent('ipns:routing:datastore:put')
        result.customRouting.put = sinon.stub<any>().callsFake(async (_key: any, _record: any, opts: any) => {
          opts?.onProgress?.(event)
        })

        const onProgress = sinon.stub()
        await name.republish(multihashFromIPNSRoutingKey(routingKey), { onProgress })

        // the routing event the router emitted reached the caller's onProgress
        expect(onProgress.calledWith(event)).to.be.true()
      })

      it('should not republish an expired local record', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, -60_000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        expect(NanoDate.fromString(uint8ArrayToString(decodeExtensibleData(record.data).Validity)).getTimeT() * 1_000).to.be.lessThan(Date.now(), 'record was not expired')

        // Store the record in the real datastore
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // Stub router GETs to not find any records
        result.customRouting.get = sinon.stub<any>().rejects(new NotFoundError())
        result.heliaRouting.get = sinon.stub<any>().rejects(new NotFoundError())

        // @ts-expect-error localStore property is private
        const storePutSpy = sinon.spy(name.localStore, 'put')

        await expect(name.republish(multihashFromIPNSRoutingKey(routingKey))).to.eventually.be.rejected
          .with.property('name', 'RecordExpiredError')

        expect(storePutSpy.called).to.be.false('updated local store')
        expect(result.customRouting.put.called).to.be.false('published expired record')
        expect(result.heliaRouting.put.called).to.be.false('published expired record')
      })
    })

    describe('error handling', () => {
      it('should throw if there is no local record to republish', async () => {
        const key = await result.keychain.generateKey('test-key')
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        await expect(name.republish(multihashFromIPNSRoutingKey(routingKey))).to.eventually.be.rejected
          .with.property('name', 'NotFoundError')
      })

      it('should not throw when the network router puts fail', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // the network routers reject; the local store still persists the record
        const putStubCustom = sinon.stub().rejects(new Error('custom router down'))
        const putStubHelia = sinon.stub().rejects(new Error('helia router down'))
        // @ts-ignore
        result.customRouting.put = putStubCustom
        // @ts-ignore
        result.heliaRouting.put = putStubHelia

        // best-effort: failing to publish to the network does not throw
        const republishResult = await name.republish(multihashFromIPNSRoutingKey(routingKey), { skipResolution: true })

        expect(republishResult).to.have.property('record')
        expect(republishResult).to.have.property('publicKey')
        expect(putStubCustom.called).to.be.true('did not attempt the custom router')
        expect(putStubHelia.called).to.be.true('did not attempt the helia router')
      })

      it('should throw when the local store put fails', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // the local store persists the record and its upkeep policy, so its
        // failure must surface rather than be swallowed like a network failure
        // @ts-expect-error localStore property is private
        sinon.stub(name.localStore, 'put').rejects(new Error('datastore write failed'))

        await expect(name.republish(multihashFromIPNSRoutingKey(routingKey), { skipResolution: true }))
          .to.be.rejectedWith('datastore write failed')
      })

      it('should throw if the routing has a newer record than our local copy', async () => {
        const key = await result.keychain.generateKey('test-key')
        const localRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routerRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 2n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // we hold seq1 locally, but the routers have a newer seq2
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(localRecord))

        getStubCustom = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
        // @ts-ignore
        result.customRouting.get = getStubCustom

        const err = await expect(name.republish(multihashFromIPNSRoutingKey(routingKey))).to.eventually.be.rejected()

        expect(err).to.have.property('name', 'RecordObsoleteError')
        expect(IPNSEntry.encode(err.record)).to.deep.equal(IPNSEntry.encode(routerRecord))
      })

      it('should republish when the routing has our record at the same sequence', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // our record is already published - the routing returns it back at the
        // same sequence, which must not count as "published elsewhere":
        // re-publishing our own record is how the upkeep policy gets overwritten
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))
        result.customRouting.get = sinon.stub<any>().resolves(IPNSEntry.encode(record))
        result.heliaRouting.get = sinon.stub<any>().resolves(IPNSEntry.encode(record))

        const republished = await name.republish(multihashFromIPNSRoutingKey(routingKey))

        expect(decodeExtensibleData(republished.record.data).Sequence).to.equal(1n)
        expect(result.customRouting.put.called).to.be.true('did not republish our own record')
        expect(result.heliaRouting.put.called).to.be.true('did not republish our own record')
      })

      it('should not publish to the routers when already published', async () => {
        const key = await result.keychain.generateKey('test-key')
        const localRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routerRecord = await createIPNSRecord(key, `/ipfs/${testCid}`, 2n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // we hold seq1 locally, but the routers have a newer seq2
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(localRecord))

        getStubCustom = sinon.stub().resolves(IPNSEntry.encode(routerRecord))
        // @ts-ignore
        result.customRouting.get = getStubCustom

        await expect(name.republish(multihashFromIPNSRoutingKey(routingKey))).to.eventually.be.rejected
          .with.property('name', 'RecordObsoleteError')

        // the already-published check runs before the publish step, so we never
        // put the record to the routers
        expect(result.customRouting.put.called).to.be.false('published to custom routing before throwing')
        expect(result.heliaRouting.put.called).to.be.false('published to Helia routing before throwing')
      })

      it('should ignore invalid records in the routing and republish the local record', async () => {
        const key = await result.keychain.generateKey('test-key')
        const record = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 24 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(record))

        // the routers return garbage bytes - an invalid record on the network must
        // not block us from republishing our own valid record
        getStubCustom = sinon.stub().resolves(new Uint8Array([1, 2, 3]))
        getStubHelia = sinon.stub().resolves(new Uint8Array([1, 2, 3]))
        // @ts-ignore
        result.customRouting.get = getStubCustom
        // @ts-ignore
        result.heliaRouting.get = getStubHelia

        const republished = await name.republish(multihashFromIPNSRoutingKey(routingKey))

        expect(decodeExtensibleData(republished.record.data).Sequence).to.equal(1n)
        expect(result.customRouting.put.called).to.be.true('did not republish the local record')
        expect(result.heliaRouting.put.called).to.be.true('did not republish the local record')
      })

      it('should back off when the routing has a same-sequence record with later validity', async () => {
        const key = await result.keychain.generateKey('test-key')
        const local = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 60 * 60 * 1000)
        const routing = await createIPNSRecord(key, `/ipfs/${testCid}`, 1n, 48 * 60 * 60 * 1000)
        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        // we hold seq1 with a near validity; the routing has seq1 too but lives
        // longer, so it is the more suitable record by the selection rules
        const store = localStore(result.datastore, result.log)
        await store.put(routingKey, IPNSEntry.encode(local))
        getStubCustom = sinon.stub().resolves(IPNSEntry.encode(routing))
        // @ts-ignore
        result.customRouting.get = getStubCustom

        const err = await expect(name.republish(multihashFromIPNSRoutingKey(routingKey))).to.eventually.be.rejected()
        expect(err).to.have.property('name', 'RecordObsoleteError')
        expect(IPNSEntry.encode(err.record)).to.deep.equal(IPNSEntry.encode(routing))
      })
    })
  })
})
