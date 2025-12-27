import { generateKeyPair } from '@libp2p/crypto/keys'
import { TypedEventEmitter } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { createIPNSRecord, marshalIPNSRecord, multihashToIPNSRoutingKey } from 'ipns'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { toString } from 'uint8arrays'
import { DEFAULT_LIFETIME_MS } from '../../src/constants.ts'
import { localStore } from '../../src/local-store.ts'
import { pubsub as pubsubRouting } from '../../src/routing/pubsub.ts'
import type { IPNSRecord, IPNSRouting } from '../../src/index.ts'
import type { LocalStore } from '../../src/local-store.ts'
import type { Message, PubSub, PubSubEvents, PubsubRoutingComponents, Subscription } from '../../src/routing/pubsub.ts'
import type { Fetch } from '@libp2p/fetch'
import type { Ed25519PrivateKey, PeerId, PublicKey } from '@libp2p/interface'
import type { StubbedInstance } from 'sinon-ts'
import { pEvent } from 'p-event'

describe('pubsub routing', () => {
  let store: LocalStore
  let peerId: StubbedInstance<PeerId>
  let pubsub: StubbedInstance<PubSub>
  let fetch: StubbedInstance<Fetch>
  let components: PubsubRoutingComponents
  let pubsubRouter: ReturnType<typeof pubsubRouting>
  let routingKey: Uint8Array
  let topic: string
  let privateKey: Ed25519PrivateKey
  let record: IPNSRecord
  let target: TypedEventEmitter<PubSubEvents>

  beforeEach(async () => {
    const datastore = new MemoryDatastore()
    const logger = defaultLogger()

    target = new TypedEventEmitter()

    store = localStore(datastore, logger.forComponent('local-store'))

    peerId = stubInterface()

    pubsub = stubInterface()
    pubsub.addEventListener.callsFake(target.addEventListener.bind(target))
    pubsub.getTopics.callsFake(() => [])

    fetch = stubInterface()

    components = {
      datastore,
      logger,
      libp2p: {
        peerId,
        services: {
          pubsub,
          fetch
        }
      }
    }

    pubsubRouter = pubsubRouting(components)

    privateKey = await generateKeyPair('Ed25519')
    routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    topic = `/record/${toString(routingKey, 'base64url')}`
    record = await createIPNSRecord(privateKey, '/test', 1n, DEFAULT_LIFETIME_MS)
  })

  describe('message', () => {
    let message: StubbedInstance<Message>
    let event: PubSubEvents['message']

    beforeEach(() => {
      message = stubInterface()
      message.topic = topic
      message.type = 'signed'
      message.from.equals = () => false
      message.data = marshalIPNSRecord(record)

      event = new CustomEvent('message', { detail: message })
    })

    describe('record handling', () => {
      it('adds record to local-store', async () => {
        try {
          await pubsubRouter.get(routingKey)
        } catch (err: any) {
          if (err.name !== 'NotFoundError') {
            throw err
          }
        }

        target.safeDispatchEvent('message', event)

        await new Promise((resolve) => setTimeout(resolve, 100))

        await expect(store.has(routingKey)).to.eventually.be.true()
      })

      it('updates record in local-store', async () => {
        try {
          await pubsubRouter.get(routingKey)
        } catch (err: any) {
          if (err.name !== 'NotFoundError') {
            throw err
          }
        }

        const batchSpy = Sinon.spy(components.datastore, 'batch')

        const newRecord = await createIPNSRecord(privateKey, '/test2', 2n, DEFAULT_LIFETIME_MS)

        const recordUpdatePromise = pEvent<'record-update', CustomEvent<{ publicKey: PublicKey, record: IPNSRecord }>>(pubsubRouter, 'record-update')

        message.data = marshalIPNSRecord(newRecord)
        target.safeDispatchEvent('message', event)

        await recordUpdatePromise

        expect(batchSpy.called).to.be.true()
      })

      it('skips the message if duplicate record', async () => {
        try {
          await pubsubRouter.get(routingKey)
        } catch (err: any) {
          if (err.name !== 'NotFoundError') {
            throw err
          }
        }
        await store.put(routingKey, marshalIPNSRecord(record))

        const batchSpy = Sinon.spy(components.datastore.batch)

        target.safeDispatchEvent('message', event)

        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(batchSpy.called).to.be.false()
      })
    })

    it('skips the message if not signed', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      message.type = 'unsigned'
      target.safeDispatchEvent('message', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if topic is not in subscriptions', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      message.topic = 'not-in-subscriptions'
      target.safeDispatchEvent('message', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if message is from our peerId', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      message.from.equals = () => true
      target.safeDispatchEvent('message', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      await expect(store.has(routingKey)).to.eventually.be.false()
    })
  })

  describe('subscription-change', () => {
    let peerId: StubbedInstance<PeerId>
    let subscription: StubbedInstance<Subscription>
    let event: PubSubEvents['subscription-change']

    beforeEach(async () => {
      peerId = stubInterface()
      subscription = stubInterface()
      subscription.topic = topic
      subscription.subscribe = true

      event = new CustomEvent('subscription-change', { detail: { peerId, subscriptions: [subscription] } })

      fetch.fetch.callsFake(async () => marshalIPNSRecord(record))
    })

    it('fetches record from joining peer', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      const recordUpdatePromise = pEvent<'record-update', CustomEvent<{ publicKey: PublicKey, record: IPNSRecord }>>(pubsubRouter, 'record-update')
      target.safeDispatchEvent('subscription-change', event)

      await recordUpdatePromise

      expect(fetch.fetch.called).to.be.true()
      await expect(store.has(routingKey)).to.eventually.be.true()
    })

    it('skips if topic not found in subscriptions', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      subscription.topic = 'not-found'
      target.safeDispatchEvent('subscription-change', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(fetch.fetch.called).to.be.false()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if peer is leaving the mesh', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      subscription.subscribe = false
      target.safeDispatchEvent('subscription-change', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(fetch.fetch.called).to.be.false()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })

    it('skips if peer does not have record', async () => {
      try {
        await pubsubRouter.get(routingKey)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }
      }

      fetch.fetch.callsFake(async () => undefined)
      target.safeDispatchEvent('subscription-change', event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(fetch.fetch.called).to.be.true()
      await expect(store.has(routingKey)).to.eventually.be.false()
    })
  })
})
