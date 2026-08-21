import { base36 } from 'multiformats/bases/base36'
import { CustomProgressEvent } from 'progress-events'
import { DEFAULT_LIFETIME_MS } from '../constants.ts'
import { IPNSEntry } from '../pb/ipns.ts'
import { createIPNSRecord } from '../records.ts'
import { decodeExtensibleData, multihashToIPNSRoutingKey } from '../utils.ts'
import type { IPNSPublishResult, IPNSPublishStrategyDetail, PublishOptions, PublishStrategyProgressEvents } from '../index.ts'
import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting } from '../routing/index.ts'
import type { Keychain, PrivateKey } from '@helia/interface'
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { ProgressOptions } from 'progress-events'

export interface IPNSPublisherComponents {
  datastore: Datastore
  logger: ComponentLogger
  keychain: Keychain
}

export interface IPNSPublisherInit {
  localStore: LocalStore
  routers: IPNSRouting[]
}

export class IPNSPublisher {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly keychain: Keychain

  constructor (components: IPNSPublisherComponents, init: IPNSPublisherInit) {
    this.keychain = components.keychain
    this.localStore = init.localStore
    this.routers = init.routers
  }

  async publish (keyName: string, value: string, options: PublishOptions = {}): Promise<IPNSPublishResult> {
    try {
      options.onProgress?.(new CustomProgressEvent('ipns:publish:start'))

      const key = await this.#loadOrCreateKey(keyName, options)
      const digest = key.publicKey.toMultihash()
      const routingKey = multihashToIPNSRoutingKey(digest)
      let sequenceNumber = 1n

      if (await this.localStore.has(routingKey, options)) {
        // if we have published under this key before, increment the sequence number
        const { record } = await this.localStore.get(routingKey, options)
        const existingRecord = IPNSEntry.decode(record)
        const data = decodeExtensibleData(existingRecord.data)
        sequenceNumber = (data.Sequence ?? 0n) + 1n
      }

      const lifetime = options.lifetime ?? DEFAULT_LIFETIME_MS
      const record = await createIPNSRecord(key, value, sequenceNumber, lifetime, {
        ...options,
        // convert ttl from milliseconds to nanoseconds as createIPNSRecord expects
        ttlNs: options.ttl != null ? BigInt(options.ttl) * 1_000_000n : undefined
      })
      const marshaledRecord = IPNSEntry.encode(record)

      if (options.offline === true) {
        await withStrategyProgressEvents({
          strategy: 'LocalStoreRouting()',
          keyName,
          publicKey: key.publicKey,
          record
        }, options, async () => {
          // only store record locally
          await this.localStore.put(routingKey, marshaledRecord, {
            ...options,
            metadata: {
              keyName,
              lifetime
            }
          })
        })
      } else {
        // publish record to routing (including the local store)
        await Promise.all(this.routers.map(async r => {
          await withStrategyProgressEvents({
            strategy: strategyName(r),
            keyName,
            publicKey: key.publicKey,
            record
          }, options, async () => {
            await r.put(routingKey, marshaledRecord, {
              ...options,
              metadata: {
                keyName,
                lifetime
              }
            })
          })
        }))
      }

      options.onProgress?.(new CustomProgressEvent<IPNSEntry>('ipns:publish:success', record))

      return {
        record,
        name: `/ipns/${key.publicKey.toCID().toString(base36)}`,
        publicKey: key.publicKey
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:publish:error', err))
      throw err
    }
  }

  /**
   * Create the private key if it is not in the keychain already, defaulting to
   * Ed25519 keys
   */
  async #loadOrCreateKey (keyName: string, options?: AbortOptions): Promise<PrivateKey> {
    try {
      return await this.keychain.exportKey(keyName, options)
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // create a new key
        return this.keychain.generateKey(keyName, options)
      } else {
        throw err
      }
    }
  }

  async unpublish (keyName: string, options?: AbortOptions): Promise<void> {
    const key = await this.keychain.exportKey(keyName, options)
    const digest = key.publicKey.toMultihash()
    const routingKey = multihashToIPNSRoutingKey(digest)
    await this.localStore.delete(routingKey, options)
  }
}

async function withStrategyProgressEvents (detail: IPNSPublishStrategyDetail, options: ProgressOptions<PublishStrategyProgressEvents>, fn: () => unknown): Promise<void> {
  options.onProgress?.(new CustomProgressEvent<IPNSPublishStrategyDetail, 'ipns:publish:strategy:start'>('ipns:publish:strategy:start', detail))

  try {
    await fn()
    options.onProgress?.(new CustomProgressEvent<IPNSPublishStrategyDetail, 'ipns:publish:strategy:success'>('ipns:publish:strategy:success', detail))
  } catch (err: any) {
    options.onProgress?.(new CustomProgressEvent<Error, 'ipns:publish:strategy:error'>('ipns:publish:strategy:error', err))
    throw err
  }
}

function strategyName (router: IPNSRouting): string {
  if (router.toString === Object.prototype.toString) {
    return 'CustomRouting()'
  }

  const strategy = router.toString()

  if (typeof strategy !== 'string' || strategy === '') {
    return 'CustomRouting()'
  }

  return strategy
}
