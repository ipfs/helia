import { publicKeyFromMultihash } from '@libp2p/crypto/keys'
import { isPublicKey, NotFoundError, TypedEventEmitter } from '@libp2p/interface'
import { logger } from '@libp2p/logger'
import { Queue } from '@libp2p/utils'
import { extractPublicKeyFromIPNSRecord, multihashFromIPNSRoutingKey, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CustomProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { InvalidTopicError } from '../errors.js'
import { localStore } from '../local-store.js'
import { IPNS_STRING_PREFIX, isCodec } from '../utils.ts'
import type { GetOptions, IPNSRouting, PutOptions } from './index.js'
import type { IPNSPublishResult } from '../index.ts'
import type { LocalStore } from '../local-store.js'
import type { Fetch } from '@libp2p/fetch'
import type { PeerId, PublicKey, TypedEventTarget, ComponentLogger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { MultihashDigest } from 'multiformats/hashes/interface'
import type { ProgressEvent } from 'progress-events'

const log = logger('helia:ipns:routing:pubsub')

export interface Message {
  type: 'signed' | 'unsigned'
  from: PeerId
  topic: string
  data: Uint8Array
}

export interface Subscription {
  topic: string
  subscribe: boolean
}

export interface SubscriptionChangeData {
  peerId: PeerId
  subscriptions: Subscription[]
}

export interface PubSubEvents {
  'subscription-change': CustomEvent<SubscriptionChangeData>
  message: CustomEvent<Message>
}

export interface PublishResult {
  recipients: PeerId[]
}

export interface PubSub extends TypedEventTarget<PubSubEvents> {
  subscribe(topic: string): void
  unsubscribe(topic: string): void
  publish(topic: string, message: Uint8Array): Promise<PublishResult>
  getTopics(): string[]
  getSubscribers(topic: string): PeerId[]
}

export interface PubsubRoutingComponents {
  datastore: Datastore
  logger: ComponentLogger
  libp2p: {
    peerId: PeerId
    services: {
      pubsub: PubSub
      fetch?: Fetch
    }
  }
}

export type PubSubProgressEvents =
  ProgressEvent<'ipns:pubsub:publish', { topic: string, result: PublishResult }> |
  ProgressEvent<'ipns:pubsub:subscribe', { topic: string }> |
  ProgressEvent<'ipns:pubsub:error', Error>

export interface PubSubRouterEvents {
  'record-update': CustomEvent<IPNSPublishResult>
}

class PubSubRouting extends TypedEventEmitter<PubSubRouterEvents> implements IPNSRouting {
  private subscriptions: string[]
  private readonly localStore: LocalStore
  private readonly peerId: PeerId
  private readonly pubsub: PubSub
  private readonly fetch: Fetch | undefined
  private readonly queue: Queue<Uint8Array | undefined>

  constructor (components: PubsubRoutingComponents) {
    super()
    this.subscriptions = []
    this.localStore = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
    this.peerId = components.libp2p.peerId
    this.pubsub = components.libp2p.services.pubsub
    this.fetch = components.libp2p.services.fetch
    this.queue = new Queue<Uint8Array | undefined>({ concurrency: 32 })

    this.pubsub.addEventListener('message', (evt) => {
      const message = evt.detail

      if (!this.subscriptions.includes(message.topic)) {
        return
      }

      this.#processPubSubMessage(message).catch(err => {
        log.error('Error processing message - %e', err)
      })
    })

    // ipns over libp2p-fetch feature
    if (this.fetch != null) {
      try {
        this.pubsub.addEventListener('subscription-change', (evt) => {
          const { peerId, subscriptions } = evt.detail

          for (const sub of subscriptions) {
            if (!this.subscriptions.includes(sub.topic)) {
              continue
            }

            if (sub.subscribe === false) {
              continue
            }

            this.#handlePeerJoin(peerId, sub.topic).catch(err => {
              log.error('Error fetching ipns record from peer %p - %e', peerId, err)
            })
          }
        })

        this.fetch.registerLookupFunction(IPNS_STRING_PREFIX, async (key) => {
          try {
            const { record } = await this.localStore.get(key)

            return record
          } catch (err: any) {
            if (err.name !== 'NotFoundError') {
              throw err
            }

            return undefined
          }
        })
        log('registered ipns lookup function with fetch service')
      } catch (e) {
        log('unable to register ipns lookup function with fetch service, may already exist')
      }
    } else {
      log('no fetch service found, skipping ipns lookup function registration')
    }
  }

  async #processPubSubMessage (message: Message): Promise<void> {
    log('message received for topic', message.topic)

    if (message.type !== 'signed') {
      log.error('unsigned message received, this module can only work with signed messages')
      return
    }

    if (message.from.equals(this.peerId)) {
      log('not storing record from self')
      return
    }

    await this.#handleRecord(topicToKey(message.topic), message.data)
  }

  async #handlePeerJoin (peerId: PeerId, topic: string): Promise<void> {
    log('peer %p joined topic %t', peerId, topic)

    if (this.fetch == null) {
      log('no libp2p fetch found, skipping record fetch')
      return
    }

    const routingKey = topicToKey(topic)

    let marshalledRecord: Uint8Array | undefined
    try {
      marshalledRecord = await this.queue.add(async () => {
        log('fetching ipns record for %t from %p', topic, peerId)
        // default timeout is 10 seconds
        // we should have an existing connection to the peer so this can be shortened
        const signal = AbortSignal.timeout(2_500)
        return this.fetch?.fetch(peerId, routingKey, { signal })
      })
    } catch (err: any) {
      log.error('failed to fetch ipns record for %t from %p', topic, peerId, err)
      return
    }

    if (marshalledRecord == null) {
      log('no record found on peer', peerId)
      return
    }

    await this.#handleRecord(routingKey, marshalledRecord)
  }

  async #handleRecord (routingKey: Uint8Array, marshalledRecord: Uint8Array): Promise<void> {
    await ipnsValidator(routingKey, marshalledRecord)

    if (await this.localStore.has(routingKey)) {
      const { record: currentRecord } = await this.localStore.get(routingKey)

      if (uint8ArrayEquals(currentRecord, marshalledRecord)) {
        log('not storing record as we already have it')
        return
      }

      const records = [currentRecord, marshalledRecord]
      const index = ipnsSelector(routingKey, records)

      if (index === 0) {
        log('not storing record as the one we have is better')
        return
      }
    }

    await this.localStore.put(routingKey, marshalledRecord)

    // emit record-updates
    const routingMultihash = multihashFromIPNSRoutingKey(routingKey)
    const record = unmarshalIPNSRecord(marshalledRecord)
    const publicKey: PublicKey = isCodec(routingMultihash, 0x0)
      ? publicKeyFromMultihash(routingMultihash)
      : extractPublicKeyFromIPNSRecord(record)!
    const event = new CustomEvent('record-update', { detail: { publicKey, record } })
    this.safeDispatchEvent<IPNSPublishResult>('record-update', event)
  }

  /**
   * Put a value to the pubsub datastore indexed by the received key properly encoded
   */
  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    try {
      const topic = keyToTopic(routingKey)

      log('publish value for topic %s', topic)
      const result = await this.pubsub.publish(topic, marshaledRecord)

      log('published record on topic %s to %d recipients', topic, result.recipients)
      options.onProgress?.(new CustomProgressEvent('ipns:pubsub:publish', { topic, result }))
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:pubsub:error', err))
      throw err
    }
  }

  /**
   * Get a value from the pubsub datastore indexed by the received key properly encoded.
   * Also, the identifier topic is subscribed to and the pubsub datastore records will be
   * updated once new publishes occur
   */
  async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
    try {
      const topic = keyToTopic(routingKey)

      // ensure we are subscribed to topic
      if (!this.pubsub.getTopics().includes(topic)) {
        log('add subscription for topic', topic)
        this.pubsub.subscribe(topic)
        this.subscriptions.push(topic)

        options.onProgress?.(new CustomProgressEvent('ipns:pubsub:subscribe', { topic }))
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:pubsub:error', err))
      throw err
    }

    throw new NotFoundError('Pubsub routing does not actively query peers.')
  }

  /**
   * Get pubsub subscriptions related to ipns
   */
  getSubscriptions (): string[] {
    return this.subscriptions
  }

  /**
   * Cancel pubsub subscriptions related to ipns
   */
  cancel (key: PublicKey | MultihashDigest<0x00 | 0x12>): void {
    const digest = isPublicKey(key) ? key.toMultihash() : key
    const routingKey = multihashToIPNSRoutingKey(digest)
    const topic = keyToTopic(routingKey)

    // Not found topic
    if (!this.subscriptions.includes(topic)) {
      return
    }

    this.pubsub.unsubscribe(topic)
    this.subscriptions = this.subscriptions.filter(t => t !== topic)
  }

  toString (): string {
    return 'PubSubRouting()'
  }
}

const PUBSUB_NAMESPACE = '/record/'

/**
 * converts a binary record key to a pubsub topic key
 */
function keyToTopic (key: Uint8Array): string {
  const b64url = uint8ArrayToString(key, 'base64url')

  return `${PUBSUB_NAMESPACE}${b64url}`
}

/**
 * converts a pubsub topic key to a binary record key
 */
function topicToKey (topic: string): Uint8Array {
  if (topic.substring(0, PUBSUB_NAMESPACE.length) !== PUBSUB_NAMESPACE) {
    throw new InvalidTopicError('Topic received is not from a record')
  }

  const key = topic.substring(PUBSUB_NAMESPACE.length)

  return uint8ArrayFromString(key, 'base64url')
}

/**
 * This IPNS routing receives IPNS record updates via dedicated
 * pubsub topic.
 *
 * Note we must first be subscribed to the topic in order to receive
 * updated records, so the first call to `.get` should be expected
 * to fail!
 */
export function pubsub (components: PubsubRoutingComponents): PubSubRouting {
  return new PubSubRouting(components)
}
