import { isPublicKey } from '@libp2p/interface'
import { logger } from '@libp2p/logger'
import { multihashToIPNSRoutingKey } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { InvalidTopicError } from '../errors.js'
import { localStore, type LocalStore } from './local-store.js'
import type { GetOptions, IPNSRouting, PutOptions } from './index.js'
import type { PeerId, Message, PublishResult, PubSub, PublicKey } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { MultihashDigest } from 'multiformats/hashes/interface'

const log = logger('helia:ipns:routing:pubsub')

export interface PubsubRoutingComponents {
  datastore: Datastore
  libp2p: {
    peerId: PeerId
    services: {
      pubsub: PubSub
    }
  }
}

export type PubSubProgressEvents =
  ProgressEvent<'ipns:pubsub:publish', { topic: string, result: PublishResult }> |
  ProgressEvent<'ipns:pubsub:subscribe', { topic: string }> |
  ProgressEvent<'ipns:pubsub:error', Error>

class PubSubRouting implements IPNSRouting {
  private subscriptions: string[]
  private readonly localStore: LocalStore
  private readonly peerId: PeerId
  private readonly pubsub: PubSub

  constructor (components: PubsubRoutingComponents) {
    this.subscriptions = []
    this.localStore = localStore(components.datastore)
    this.peerId = components.libp2p.peerId
    this.pubsub = components.libp2p.services.pubsub

    this.pubsub.addEventListener('message', (evt) => {
      const message = evt.detail

      if (!this.subscriptions.includes(message.topic)) {
        return
      }

      this.#processPubSubMessage(message).catch(err => {
        log.error('Error processing message', err)
      })
    })
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

    const routingKey = topicToKey(message.topic)

    await ipnsValidator(routingKey, message.data)

    if (await this.localStore.has(routingKey)) {
      const { record: currentRecord } = await this.localStore.get(routingKey)

      if (uint8ArrayEquals(currentRecord, message.data)) {
        log('not storing record as we already have it')
        return
      }

      const records = [currentRecord, message.data]
      const index = ipnsSelector(routingKey, records)

      if (index === 0) {
        log('not storing record as the one we have is better')
        return
      }
    }

    await this.localStore.put(routingKey, message.data)
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

      // chain through to local store
      const { record } = await this.localStore.get(routingKey, options)

      return record
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:pubsub:error', err))
      throw err
    }
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
export function pubsub (components: PubsubRoutingComponents): IPNSRouting {
  return new PubSubRouting(components)
}
