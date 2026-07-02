import { keychain } from '@ipshipyard/keychain'
import { start, stop, TypedEventEmitter } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import delay from 'delay'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { toString } from 'uint8arrays'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { DEFAULT_LIFETIME_MS } from '../../src/constants.ts'
import { localStore } from '../../src/local-store.ts'
import { IPNSEntry } from '../../src/pb/ipns.ts'
import { createIPNSRecord } from '../../src/records.ts'
import { PubSubIPNSRouting } from '../../src/routing/pubsub.ts'
import { decodeExtensibleData, multihashToIPNSRoutingKey } from '../../src/utils.ts'
import { ipnsValidator } from '../../src/validator.ts'
import { getCrypto } from '../fixtures/get-crypto.ts'
import type { LocalStore } from '../../src/local-store.ts'
import type { PubSubMessage, PubSub, PubSubEvents, PubSubSubscription } from '../../src/routing/pubsub.ts'
import type { Keychain, PrivateKey } from '@helia/interface'
import type { Fetch } from '@libp2p/fetch'
import type { Libp2p, PeerId } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { StubbedInstance } from 'sinon-ts'

describe('pubsub routing', () => {
  let datastore: Datastore
  let store: LocalStore
  let peerId: StubbedInstance<PeerId>
  let pubsub: StubbedInstance<PubSub>
  let fetch: StubbedInstance<Fetch>
  let pubsubRouter: PubSubIPNSRouting
  let routingKey: Uint8Array
  let topic: string
  let privateKey: PrivateKey
  let record: IPNSEntry
  let target: TypedEventEmitter<PubSubEvents>
  let libp2p: StubbedInstance<Libp2p<{ pubsub: StubbedInstance<PubSub>, fetch: StubbedInstance<Fetch> }>>
  let kc: Keychain

  beforeEach(async () => {
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    target = new TypedEventEmitter()
    store = localStore(datastore, logger.forComponent('local-store'))
    peerId = stubInterface()
    fetch = stubInterface()

    pubsub = stubInterface<PubSub>()
    pubsub.addEventListener.callsFake(target.addEventListener.bind(target))
    pubsub.getTopics.callsFake(() => [])

    libp2p = stubInterface<Libp2p<{ pubsub: StubbedInstance<PubSub>, fetch: StubbedInstance<Fetch> }>>({
      peerId,
      services: {
        pubsub,
        fetch
      }
    })

    kc = keychain()({
      datastore,
      getCrypto
    })

    pubsubRouter = new PubSubIPNSRouting({
      datastore,
      logger,
      libp2p,
      keychain: kc
    })

    privateKey = await kc.generateKey('test-key')
    routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    topic = `/record/${toString(routingKey, 'base64url')}`
    record = await createIPNSRecord(privateKey, '/test', 1n, DEFAULT_LIFETIME_MS)

    await start(pubsubRouter)
  })

  afterEach(async () => {
    await stop(pubsubRouter)
  })

  describe('message', () => {
    let message: StubbedInstance<PubSubMessage>
    let event: PubSubEvents['message']

    beforeEach(() => {
      message = stubInterface()
      message.topic = topic
      message.type = 'signed'
      message.from.equals = () => false
      message.data = IPNSEntry.encode(record)

      event = new CustomEvent('message', { detail: message })
    })

    it('fetches record from peers and does not wait for update', async () => {
      // the peer supports fetch
      libp2p.register.getCall(0).args[1]?.onConnect?.(peerId, stubInterface())

      libp2p.services.pubsub.getSubscribers.returns([
        peerId
      ])

      libp2p.services.pubsub.publish.resolves({
        recipients: []
      })

      const marshaledRecord = IPNSEntry.encode(record)
      fetch.fetch.withArgs(peerId).resolves(marshaledRecord)

      const result = await pubsubRouter.get(routingKey)

      expect(result).to.equalBytes(marshaledRecord)
    })

    describe('record handling', () => {
      it('adds record to local store', async () => {
        libp2p.services.pubsub.getSubscribers.returns([])

        await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
          .with.property('name', 'NotFoundError')

        target.safeDispatchEvent('message', event)

        await delay(100)

        await expect(store.has(routingKey)).to.eventually.be.true()
      })

      it('updates record in local store', async () => {
        libp2p.services.pubsub.getSubscribers.returns([])

        await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
          .with.property('name', 'NotFoundError')

        const newRecord = await createIPNSRecord(privateKey, '/test2', 2n, DEFAULT_LIFETIME_MS)

        message.data = IPNSEntry.encode(newRecord)
        target.safeDispatchEvent('message', event)

        await delay(100)

        const result = await store.get(routingKey)
        const updatedRecord = await ipnsValidator(routingKey, result.record, kc)
        const data = decodeExtensibleData(updatedRecord.data)
        expect(data.Sequence).to.equal(2n)
        expect(data.Value).to.equalBytes(uint8ArrayFromString('/test2'))
      })

      it('skips the message if duplicate record', async () => {
        libp2p.services.pubsub.getSubscribers.returns([])

        await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
          .with.property('name', 'NotFoundError')
        await store.put(routingKey, IPNSEntry.encode(record))

        const batchSpy = Sinon.spy(datastore.batch)

        target.safeDispatchEvent('message', event)

        await delay(100)

        expect(batchSpy.called).to.be.false()
      })
    })

    it('skips the message if not signed', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      message.type = 'unsigned'
      target.safeDispatchEvent('message', event)

      await delay(100)

      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if topic is not in subscriptions', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      message.topic = 'not-in-subscriptions'
      target.safeDispatchEvent('message', event)

      await delay(100)

      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if message is from our peerId', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      message.from.equals = () => true
      target.safeDispatchEvent('message', event)

      await delay(100)

      await expect(store.has(routingKey)).to.eventually.be.false()
    })
  })

  describe('subscription-change', () => {
    let peerId: StubbedInstance<PeerId>
    let subscription: StubbedInstance<PubSubSubscription>
    let event: PubSubEvents['subscription-change']

    beforeEach(async () => {
      peerId = stubInterface()
      subscription = stubInterface({
        topic,
        subscribe: true
      })

      event = new CustomEvent('subscription-change', {
        detail: {
          peerId,
          subscriptions: [
            subscription
          ]
        }
      })

      fetch.fetch.callsFake(async () => IPNSEntry.encode(record))

      // the peer supports fetch
      libp2p.register.getCall(0).args[1]?.onConnect?.(peerId, stubInterface())
    })

    it('fetches record from joining peer', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      target.safeDispatchEvent('subscription-change', event)

      await delay(100)

      expect(fetch.fetch.called).to.be.true()
      await expect(store.has(routingKey)).to.eventually.be.true()
    })

    it('skips if topic not found in subscriptions', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      subscription.topic = 'not-found'
      target.safeDispatchEvent('subscription-change', event)

      await delay(100)

      expect(fetch.fetch.called).to.be.false()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if peer is leaving the mesh', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      subscription.subscribe = false
      target.safeDispatchEvent('subscription-change', event)

      await delay(100)

      expect(fetch.fetch.called).to.be.false()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if peer does not have record', async () => {
      libp2p.services.pubsub.getSubscribers.returns([])

      await expect(pubsubRouter.get(routingKey)).to.eventually.be.rejected
        .with.property('name', 'NotFoundError')

      fetch.fetch.callsFake(async () => undefined)
      target.safeDispatchEvent('subscription-change', event)

      await delay(100)

      expect(fetch.fetch.called).to.be.true()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })
  })
})
