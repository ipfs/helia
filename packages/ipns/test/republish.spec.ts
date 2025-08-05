/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { expect } from 'aegir/chai'
import { createIPNSRecord, marshalIPNSRecord, unmarshalIPNSRecord, multihashToIPNSRoutingKey } from 'ipns'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { localStore } from '../src/routing/local-store.js'
import { createIPNS } from './fixtures/create-ipns.js'
import type { IPNS } from '../src/index.js'
import type { CreateIPNSResult } from './fixtures/create-ipns.js'

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

describe('republish', () => {
  const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  let name: IPNS
  let result: CreateIPNSResult
  let putStubCustom: sinon.SinonStub
  let putStubHelia: sinon.SinonStub
  let abortController: AbortController

  beforeEach(async () => {
    abortController = new AbortController()
    result = await createIPNS()
    name = result.name

    // Stub the routers by default
    putStubCustom = sinon.stub().resolves()
    putStubHelia = sinon.stub().resolves()
    // @ts-ignore
    result.customRouting.put = putStubCustom
    // @ts-ignore
    result.heliaRouting.put = putStubHelia
  })

  afterEach(() => {
    abortController.abort()
    sinon.restore()
    sinon.reset()
  })

  describe('basic functionality', () => {
    it('should start republishing when called', async () => {
      // Create a test record and store it in the real datastore
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore using the localStore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })
      // Start republishing
      name.republish({ interval: 1, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      // Only check custom router for most tests
      expect(putStubCustom.called).to.be.true()
    })

    it('should call all routers for republish', async () => {
      // Create a test record and store it in the real datastore
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore using the localStore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })
      // Start republishing
      name.republish({ interval: 1, signal: abortController.signal })
      await Promise.all([
        waitForStubCall(putStubCustom),
        waitForStubCall(putStubHelia)
      ])

      // Check both routers
      expect(putStubCustom.called).to.be.true()
      expect(putStubHelia.called).to.be.true()
      expect(putStubCustom.firstCall.args[0]).to.deep.equal(routingKey)
      expect(putStubHelia.firstCall.args[0]).to.deep.equal(routingKey)
    })

    it('should throw error when republish is already running', async () => {
      // Start republishing
      name.republish({ interval: 1 })

      // Try to start again immediately
      expect(() => name.republish()).to.throw('Republish is already running')
    })

    it('should republish records with valid metadata', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      // Verify the record was republished with incremented sequence
      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      expect(callArgs[0]).to.deep.equal(routingKey)

      const republishedRecord = unmarshalIPNSRecord(callArgs[1])
      expect(republishedRecord.sequence).to.equal(2n) // Incremented from 1n
    })
  })

  describe('record processing', () => {
    it('should skip records without metadata', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record without metadata (simulate old records)
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record)) // No metadata

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
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
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await new Promise(resolve => setTimeout(resolve, 20))

      // Verify no records were republished due to error
      expect(putStubCustom.called).to.be.false()
    })

    it('should increment sequence numbers correctly', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 5n, 24 * 60 * 60 * 1000) // Start with sequence 5
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      expect(putStubCustom.called).to.be.true()

      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = unmarshalIPNSRecord(callArgs[1])
      expect(republishedRecord.sequence).to.equal(6n) // Incremented from 5n
    })
  })

  describe('progress events', () => {
    it('should emit start progress event', async () => {
      const progressEvents: any[] = []

      const interval = 1
      name.republish({
        interval,
        signal: abortController.signal,
        onProgress: (evt) => {
          progressEvents.push(evt)
        }
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      expect(progressEvents.some(evt => evt.type === 'ipns:republish:start')).to.be.true()
    })

    it('should emit success progress events for each record', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const progressEvents: any[] = []

      const interval = 5
      name.republish({
        interval,
        signal: abortController.signal,
        onProgress: (evt) => {
          progressEvents.push(evt)
        }
      })

      await waitForStubCall(putStubCustom)

      expect(progressEvents.some(evt => evt.type === 'ipns:republish:success')).to.be.true()
    })

    it('should emit error progress events for failed records', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      // Make all routers fail
      result.customRouting.put.throws(new Error('Router error'))
      result.heliaRouting.put.throws(new Error('Router error'))

      const progressEvents: any[] = []

      const interval = 5
      name.republish({
        interval,
        signal: abortController.signal,
        onProgress: (evt) => {
          progressEvents.push(evt)
        }
      })

      while (!result.customRouting.put.threw() || !result.heliaRouting.put.threw()) {
        await new Promise(resolve => setTimeout(resolve, 2))
      }

      expect(progressEvents.some(evt => evt.type === 'ipns:republish:error')).to.be.true()
    })
  })

  describe('abort signal', () => {
    it('should stop republishing when aborted', async () => {
      const abortController = new AbortController()
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()

      const interval = 50
      name.republish({ interval, signal: abortController.signal })

      // Abort before the interval
      abortController.abort()

      // Should not have republished due to abort
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should clear timeout when the Helia emits a stop event', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 50
      name.republish({ interval })

      // Emit stop event immediately
      result.events.dispatchEvent(new CustomEvent('stop'))

      // Wait for the interval to pass
      await new Promise(resolve => setTimeout(resolve, interval + 10))

      // Should not have republished after stop event due to cleared timeout
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })
  })

  describe('TTL and lifetime', () => {
    it('should use existing TTL from records', async () => {
      const key = await generateKeyPair('Ed25519')
      const customTtl = BigInt(10 * 60 * 1000) * 1_000_000n // 10 minutes in nanoseconds
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000, { ttlNs: customTtl })
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      // Verify the record was republished with incremented sequence
      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      expect(callArgs[0]).to.deep.equal(routingKey)

      const republishedRecord = unmarshalIPNSRecord(callArgs[1])
      expect(republishedRecord.sequence).to.equal(2n) // Incremented from 1n
      expect(republishedRecord.ttl).to.equal(customTtl)
    })

    it('should use default TTL when not present', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      expect(putStubCustom.called).to.be.true()
      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = unmarshalIPNSRecord(callArgs[1])
      expect(republishedRecord.ttl).to.equal(5n * 60n * 1000n * 1_000_000n) // Default TTL
    })

    it('should use metadata lifetime', async () => {
      const key = await generateKeyPair('Ed25519')
      const customLifetime = 5 * 1000 // 5 seconds
      const republishInterval = 1
      const record = await createIPNSRecord(key, testCid, 1n, customLifetime)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key into the real keychain
      await result.ipnsKeychain.importKey('test-key', key)

      // Store the record in the real datastore
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'test-key',
          lifetime: customLifetime
        }
      })

      name.republish({ interval: republishInterval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      const expectedValidity = Date.now() + customLifetime

      expect(putStubCustom.called).to.be.true()

      const callArgs = putStubCustom.firstCall.args
      const republishedRecord = unmarshalIPNSRecord(callArgs[1])

      // Check that the validity is set to the custom lifetime
      const actualValidity = new Date(republishedRecord.validity)

      const timeDiff = Math.abs(actualValidity.getTime() - expectedValidity)
      expect(timeDiff).to.be.lessThan(200)
    })
  })

  describe('error handling', () => {
    it('should skip republishing records with missing key', async () => {
      const key = await generateKeyPair('Ed25519')
      const record = await createIPNSRecord(key, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Store the record in the real datastore (but don't import the key)
      const store = localStore(result.datastore, result.log)
      await store.put(routingKey, marshalIPNSRecord(record), {
        metadata: {
          keyName: 'missing-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 5
      name.republish({ interval, signal: abortController.signal })

      await new Promise(resolve => setTimeout(resolve, interval + 10))
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
      name.localStore = store

      const progressEvents: any[] = []
      const interval = 20
      name.republish({
        interval,
        signal: abortController.signal,
        onProgress: (evt) => progressEvents.push(evt)
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      expect(listStub.called).to.be.true()
      // Should not republish due to list error
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()

      // Check if error progress event was emitted
      const errorEvent = progressEvents.find(evt => evt.type === 'ipns:republish:error')
      expect(errorEvent).to.exist()
    })

    it('should emit error progress events when localStore.list() fails', async () => {
      const store = localStore(result.datastore, result.log)
      const progressEvents: any[] = []

      // Stub list to emit error progress event and then throw
      // eslint-disable-next-line require-yield
      const listStub = sinon.stub(store, 'list').callsFake(async function * (options) {
        // Simulate the error progress event emission
        options?.onProgress?.({
          type: 'ipns:routing:datastore:error',
          detail: new Error('List operation failed')
        })
        throw new Error('List operation failed')
      })

      // Override the localStore
      // @ts-ignore
      name.localStore = store

      const interval = 1
      name.republish({
        interval,
        signal: abortController.signal,
        onProgress: (evt) => progressEvents.push(evt)
      })

      await new Promise(resolve => setTimeout(resolve, 20))

      expect(listStub.called).to.be.true()
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()

      // Check if datastore error progress event was emitted
      const datastoreErrorEvent = progressEvents.find(evt => evt.type === 'ipns:routing:datastore:error')
      expect(datastoreErrorEvent).to.exist()
      expect(datastoreErrorEvent.detail.message).to.equal('List operation failed')
    })

    it('should handle corrupt record data during republish iteration', async () => {
      const key = await generateKeyPair('Ed25519')
      const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

      // Import the key
      await result.ipnsKeychain.importKey('test-key', key)

      const store = localStore(result.datastore, result.log)

      // Store corrupt record data that will fail to unmarshal
      await store.put(routingKey, new Uint8Array([255, 255, 255]), {
        metadata: {
          keyName: 'test-key',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })

      await new Promise(resolve => setTimeout(resolve, 20))

      // Should not republish due to unmarshal error
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })

    it('should continue republishing other records when one record fails', async () => {
      const key1 = await generateKeyPair('Ed25519')
      const key2 = await generateKeyPair('Ed25519')
      const record2 = await createIPNSRecord(key2, testCid, 1n, 24 * 60 * 60 * 1000)
      const routingKey1 = multihashToIPNSRoutingKey(key1.publicKey.toMultihash())
      const routingKey2 = multihashToIPNSRoutingKey(key2.publicKey.toMultihash())

      // Import both keys
      await result.ipnsKeychain.importKey('test-key-1', key1)
      await result.ipnsKeychain.importKey('test-key-2', key2)

      const store = localStore(result.datastore, result.log)

      // Store one valid record and one corrupt record
      await store.put(routingKey1, new Uint8Array([255, 255, 255]), {
        metadata: {
          keyName: 'test-key-1',
          lifetime: 24 * 60 * 60 * 1000
        }
      })
      await store.put(routingKey2, marshalIPNSRecord(record2), {
        metadata: {
          keyName: 'test-key-2',
          lifetime: 24 * 60 * 60 * 1000
        }
      })

      const interval = 1
      name.republish({ interval, signal: abortController.signal })
      await waitForStubCall(putStubCustom)

      // Should republish the valid record despite the corrupt one
      expect(putStubCustom.called).to.be.true()
      expect(putStubHelia.called).to.be.true()
    })
  })
})
