import { base36 } from 'multiformats/bases/base36'
import { CustomProgressEvent } from 'progress-events'
import { DEFAULT_LIFETIME_MS } from '../constants.ts'
import { IPNSEntry } from '../pb/ipns.ts'
import { Upkeep } from '../pb/metadata.ts'
import { createIPNSRecord } from '../records.ts'
import { decodeExtensibleData, multihashToIPNSRoutingKey } from '../utils.ts'
import type { IPNSPublishResult, PublishOptions, UnpublishOptions } from '../index.ts'
import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting } from '../routing/index.ts'
import type { Keychain, PrivateKey, PublicKey } from '@helia/interface'
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { MultihashDigest } from 'multiformats/hashes/interface'

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

  async publish (keyName: string, value: PublicKey | CID | MultihashDigest | string, options: PublishOptions = {}): Promise<IPNSPublishResult> {
    try {
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

      const metadata = { keyName, lifetime, upkeep: Upkeep[options.upkeep ?? 'reissue'] }
      if (options.offline === true) {
        // only store record locally
        await this.localStore.put(routingKey, marshaledRecord, { ...options, metadata })
      } else {
        // publish record to routing (including the local store)
        await Promise.all(this.routers.map(async r => {
          await r.put(routingKey, marshaledRecord, { ...options, metadata })
        }))
      }

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

  async unpublish (keyName: string | MultihashDigest, options?: UnpublishOptions): Promise<void> {
    if (typeof keyName === 'string') {
      const key = await this.keychain.exportKey(keyName, options)
      keyName = key.publicKey.toMultihash()
    }

    const routingKey = multihashToIPNSRoutingKey(keyName)

    if (options?.removeRecord === true) {
      // delete the record and its metadata so this node stops serving it
      await this.localStore.delete(routingKey, options)
      return
    }

    // remove only the metadata so the record is still served but no longer
    // automatically republished; it expires naturally at its validity
    await this.localStore.deleteMetadata(routingKey, options)
  }
}
