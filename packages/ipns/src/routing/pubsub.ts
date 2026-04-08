import { isPublicKey, NotFoundError, setMaxListeners } from '@libp2p/interface'
import { logger } from '@libp2p/logger'
import { PeerSet } from '@libp2p/peer-collections'
import { Queue } from '@libp2p/utils'
import { anySignal } from 'any-signal'
import delay from 'delay'
import { multihashToIPNSRoutingKey } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CustomProgressEvent } from 'progress-events'
import { raceSignal } from 'race-signal'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { InvalidTopicError } from '../errors.ts'
import { localStore } from '../local-store.ts'
import { IPNS_STRING_PREFIX } from '../utils.ts'
import type { GetOptions, IPNSRouting, PutOptions } from './index.ts'
import type { LocalStore } from '../local-store.ts'
import type { Fetch } from '@libp2p/fetch'
import type { PeerId, PublicKey, TypedEventTarget, ComponentLogger, Startable, AbortOptions, Metrics, Libp2p } from '@libp2p/interface'
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
  metrics?: Metrics
  libp2p: Pick<Libp2p<{ pubsub: PubSub, fetch?: Fetch }>, 'peerId' | 'register' | 'unregister' | 'services'>
}

export interface PubsubRoutingInit {
  /**
   * How many fetch requests to run concurrently
   *
   * @default 8
   */
  fetchConcurrency?: number

  /**
   * How long to allow a fetch request to run for in ms
   *
   * @default 2_500
   */
  fetchTimeout?: number

  /**
   * How many ms to wait before sending a fetch request to a topic peer
   *
   * @default 0
   */
  fetchDelay?: number
}

export type PubSubProgressEvents =
  ProgressEvent<'ipns:pubsub:publish', { topic: string, result: PublishResult }> |
  ProgressEvent<'ipns:pubsub:subscribe', { topic: string }> |
  ProgressEvent<'ipns:pubsub:error', Error>

export class PubSubRouting implements IPNSRouting, Startable {
  private readonly subscriptions: Set<string>
  private readonly localStore: LocalStore
  private readonly libp2p: Pick<Libp2p<{ pubsub: PubSub, fetch?: Fetch }>, 'peerId' | 'register' | 'unregister' | 'services'>
  private readonly fetchConcurrency: number
  private readonly fetchTimeout: number
  private readonly fetchDelay: number
  private readonly fetchQueue: Queue<Uint8Array | undefined>
  private readonly fetchPeers: PeerSet
  private shutdownController: AbortController
  private fetchTopologyId?: string

  constructor (components: PubsubRoutingComponents, init: PubsubRoutingInit = {}) {
    this.subscriptions = new Set()
    this.shutdownController = new AbortController()
    setMaxListeners(Infinity, this.shutdownController.signal)
    this.fetchPeers = new PeerSet()
    this.localStore = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
    this.libp2p = components.libp2p
    this.fetchConcurrency = init.fetchConcurrency ?? 8
    this.fetchDelay = init.fetchDelay ?? 0

    // default libp2p-fetch timeout is 10 seconds - we should have an existing
    // connection to the peer so this can be shortened
    this.fetchTimeout = init.fetchTimeout ?? 2_500
    this.fetchQueue = new Queue<Uint8Array | undefined>({
      concurrency: this.fetchConcurrency,
      metrics: components.metrics,
      metricName: 'helia_ipns_pubsub_fetch_queue'
    })

    this.libp2p.services.pubsub.addEventListener('message', (evt) => {
      const message = evt.detail

      if (!this.subscriptions.has(message.topic)) {
        return
      }

      this.#processPubSubMessage(message, {
        signal: this.shutdownController.signal
      }).catch(err => {
        log.error('Error processing message - %e', err)
      })
    })

    // ipns over libp2p-fetch feature
    if (this.libp2p.services.fetch != null) {
      try {
        this.libp2p.services.pubsub.addEventListener('subscription-change', (evt) => {
          const { peerId, subscriptions } = evt.detail

          if (!this.fetchPeers.has(peerId)) {
            return
          }

          for (const sub of subscriptions) {
            if (!this.subscriptions.has(sub.topic)) {
              continue
            }

            if (sub.subscribe === false) {
              continue
            }

            log('peer %s joined topic %s', peerId, sub.topic)

            const routingKey = topicToKey(sub.topic)
            this.#fetchFromPeer(sub.topic, routingKey, peerId, {
              signal: this.shutdownController.signal
            })
              .catch(err => {
                log.error('failed to fetch IPNS record for %m from peer %s - %e', routingKey, peerId, err)
              })
          }
        })

        this.libp2p.services.fetch.registerLookupFunction(IPNS_STRING_PREFIX, async (key) => {
          try {
            const { record } = await this.localStore.get(key, {
              signal: this.shutdownController.signal
            })

            return record
          } catch (err: any) {
            if (err.name !== 'NotFoundError') {
              throw err
            }
          }
        })
        log('registered lookup function for IPNS with libp2p/fetch service')
      } catch (e) {
        log('unable to register lookup function for IPNS with libp2p/fetch service - %e', e)
      }
    } else {
      log('no libp2p/fetch service found. Skipping registration of lookup function for IPNS.')
    }
  }

  async #processPubSubMessage (message: Message, options?: AbortOptions): Promise<void> {
    log('message received for topic', message.topic)

    if (message.type !== 'signed') {
      log.error('unsigned message received, this module can only work with signed messages')
      return
    }

    if (message.from.equals(this.libp2p.peerId)) {
      log('not storing record from self')
      return
    }

    await this.#handleRecord(message.topic, topicToKey(message.topic), message.data, false, options)
  }

  async #fetchFromPeer (topic: string, routingKey: Uint8Array, peerId: PeerId, options?: AbortOptions): Promise<Uint8Array> {
    const marshalledRecord = await this.fetchQueue.add(async ({ signal }) => {
      log('fetching ipns record for %m from peer %s', routingKey, peerId)

      const sig = anySignal([
        signal,
        AbortSignal.timeout(this.fetchTimeout)
      ])

      try {
        return await this.libp2p.services.fetch?.fetch(peerId, routingKey, {
          signal: sig
        })
      } finally {
        sig.clear()
      }
    }, options)

    if (marshalledRecord == null) {
      throw new NotFoundError(`Peer ${peerId} did not have record for routing key ${uint8ArrayToString(routingKey, 'base64')}`)
    }

    log('fetched ipns record for %m from peer %s', routingKey, peerId)
    return this.#handleRecord(topic, routingKey, marshalledRecord, true, options)
  }

  async #handleRecord (topic: string, routingKey: Uint8Array, marshalledRecord: Uint8Array, publish: boolean, options?: AbortOptions): Promise<Uint8Array> {
    await ipnsValidator(routingKey, marshalledRecord)
    this.shutdownController.signal.throwIfAborted()

    if (await this.localStore.has(routingKey)) {
      const { record: currentRecord } = await this.localStore.get(routingKey, options)

      if (uint8ArrayEquals(currentRecord, marshalledRecord)) {
        log.trace('found identical record for %m', routingKey)
        return currentRecord
      }

      const records = [currentRecord, marshalledRecord]
      const index = ipnsSelector(routingKey, records)

      if (index === 0) {
        log.trace('found old record for %m', routingKey)
        return currentRecord
      }
    }

    log('found new record for %m', routingKey)
    await this.localStore.put(routingKey, marshalledRecord, options)

    // if the record was received via fetch, republish it
    if (publish) {
      log('publish value for topic %s', topic)

      try {
        const result = await this.libp2p.services.pubsub.publish(topic, marshalledRecord)
        log('published record on topic %s to %d recipients', topic, result.recipients)
      } catch (err) {
        log.error('could not publish record on topic %s - %e', err)
      }
    }

    return marshalledRecord
  }

  /**
   * Put a value to the pubsub datastore indexed by the received key properly encoded
   */
  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    try {
      const topic = keyToTopic(routingKey)

      log('publish value for topic %s', topic)
      const result = await this.libp2p.services.pubsub.publish(topic, marshaledRecord)
      options?.signal?.throwIfAborted()

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
    const topic = keyToTopic(routingKey)

    try {
      // ensure we are subscribed to topic
      if (!this.libp2p.services.pubsub.getTopics().includes(topic)) {
        log('add subscription for topic', topic)
        this.libp2p.services.pubsub.subscribe(topic)
        this.subscriptions.add(topic)

        options.onProgress?.(new CustomProgressEvent('ipns:pubsub:subscribe', { topic }))
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:pubsub:error', err))
      throw err
    }

    // delay before fetch to allow pubsub to resolve
    await raceSignal(delay(this.fetchDelay), this.shutdownController.signal)

    const fetchController = new AbortController()
    const promises: Array<Promise<Uint8Array>> = []

    for (const peerId of this.libp2p.services.pubsub.getSubscribers(topic)) {
      const signal = anySignal([
        options?.signal,
        fetchController.signal
      ])

      promises.push(
        this.#fetchFromPeer(topic, routingKey, peerId, {
          ...options,
          signal
        })
          .finally(() => {
            signal.clear()
          })
      )
    }

    if (promises.length > 0) {
      // fetch record from topic peers
      const record = await Promise.any(promises)

      // cancel any in-flight requests
      fetchController.abort()

      if (record != null) {
        return record
      }
    }

    throw new NotFoundError('Pubsub routing does not actively query peers')
  }

  /**
   * Get pubsub subscriptions related to ipns
   */
  getSubscriptions (): string[] {
    return [...this.subscriptions]
  }

  /**
   * Cancel pubsub subscriptions related to ipns
   */
  cancel (key: PublicKey | MultihashDigest<0x00 | 0x12>): void {
    const digest = isPublicKey(key) ? key.toMultihash() : key
    const routingKey = multihashToIPNSRoutingKey(digest)
    const topic = keyToTopic(routingKey)

    // Not found topic
    if (!this.subscriptions.has(topic)) {
      return
    }

    this.libp2p.services.pubsub.unsubscribe(topic)
    this.subscriptions.delete(topic)
  }

  toString (): string {
    return 'PubSubRouting()'
  }

  async start (): Promise<void> {
    this.shutdownController = new AbortController()
    setMaxListeners(Infinity, this.shutdownController.signal)

    if (this.libp2p.services.fetch != null) {
      this.fetchTopologyId = await this.libp2p.register(this.libp2p.services.fetch.protocol, {
        onConnect: (peerId) => {
          this.fetchPeers.add(peerId)
        },
        onDisconnect: (peerId) => {
          this.fetchPeers.delete(peerId)
        }
      }, {
        signal: this.shutdownController.signal
      })
    }
  }

  stop (): void {
    this.fetchQueue.abort()
    this.shutdownController.abort()

    if (this.fetchTopologyId != null) {
      this.libp2p.unregister(this.fetchTopologyId)
    }
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
export function pubsub (components: PubsubRoutingComponents, init: PubsubRoutingInit = {}): IPNSRouting {
  return new PubSubRouting(components, init)
}
