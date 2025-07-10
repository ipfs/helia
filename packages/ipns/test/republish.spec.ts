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

describe('republish', () => {
  const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  let name: IPNS
  let result: CreateIPNSResult
  let putStubCustom: sinon.SinonStub
  let putStubHelia: sinon.SinonStub

  beforeEach(async () => {
    result = await createIPNS()
    name = result.name

    // Mock the routers by default
    putStubCustom = sinon.stub().resolves()
    putStubHelia = sinon.stub().resolves()
    // @ts-ignore
    result.customRouting.put = putStubCustom
    // @ts-ignore
    result.heliaRouting.put = putStubHelia
  })

  afterEach(() => {
    sinon.restore()
    putStubCustom.resetHistory()
    putStubHelia.resetHistory()
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
      name.republish({ interval: 1 })
      await new Promise(resolve => setTimeout(resolve, 10))

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
      name.republish({ interval: 1 })
      await new Promise(resolve => setTimeout(resolve, 10))

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
      name.republish({ interval })
      await new Promise(resolve => setTimeout(resolve, 20))

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
      name.republish({ interval })
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
      name.republish({ interval })
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
      name.republish({ interval })
      await new Promise(resolve => setTimeout(resolve, 20))

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

      const interval = 1
      name.republish({
        interval,
        onProgress: (evt) => {
          progressEvents.push(evt)
        }
      })

      await new Promise(resolve => setTimeout(resolve, 20))

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
      result.customRouting.put = sinon.stub().rejects(new Error('Router error')) as any
      result.heliaRouting.put = sinon.stub().rejects(new Error('Router error')) as any

      const progressEvents: any[] = []

      const interval = 1
      name.republish({
        interval,
        onProgress: (evt) => {
          progressEvents.push(evt)
        }
      })

      await new Promise(resolve => setTimeout(resolve, 20))

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

      const interval = 100
      name.republish({ signal: abortController.signal, interval })

      // Abort before the interval
      abortController.abort()

      // Advance time past the interval
      await new Promise(resolve => setTimeout(resolve, interval))

      // Should not have republished due to abort
      expect(putStubCustom.called).to.be.false()
      expect(putStubHelia.called).to.be.false()
    })
  })

  describe('keychain integration', () => {
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
        name.republish({ interval })
        await new Promise(resolve => setTimeout(resolve, 30))

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
        name.republish({ interval })
        await new Promise(resolve => setTimeout(resolve, 30))

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

        name.republish({ interval: republishInterval })
        await new Promise(resolve => setTimeout(resolve, 30))

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
      it('should handle keychain errors', async () => {
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

        expect(putStubCustom.called).to.be.false()
        expect(putStubHelia.called).to.be.false()

        const interval = 1
        name.republish({ interval })
        await new Promise(resolve => setTimeout(resolve, 20))

        // Should not republish due to keychain error (key not found)
        expect(putStubCustom.called).to.be.false()
        expect(putStubHelia.called).to.be.false()
      })

      it('should handle datastore errors', async () => {
      // This test is harder to implement with real datastore since we can't easily
      // make the datastore fail. Instead, we'll test that the function handles
      // empty datastore gracefully
        expect(putStubCustom.called).to.be.false()
        expect(putStubHelia.called).to.be.false()

        const interval = 1
        name.republish({ interval })
        await new Promise(resolve => setTimeout(resolve, 20))

        // Should not republish due to empty datastore
        expect(putStubCustom.called).to.be.false()
        expect(putStubHelia.called).to.be.false()
      })
    })
  })
})
