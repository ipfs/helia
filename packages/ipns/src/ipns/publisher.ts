import { generateKeyPair } from '@libp2p/crypto/keys'
import { isPeerId } from '@libp2p/interface'
import { createIPNSRecord, marshalIPNSRecord, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { DEFAULT_LIFETIME_MS, DEFAULT_TTL_NS } from '../constants.ts'
import { Upkeep } from '../pb/metadata.ts'
import { keyToMultihash } from '../utils.ts'
import type { IPNSPublishResult, PublishOptions } from '../index.js'
import type { LocalStore } from '../local-store.js'
import type { IPNSRouting } from '../routing/index.js'
import type { AbortOptions, ComponentLogger, Libp2p, PeerId, PrivateKey, PublicKey } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { Datastore } from 'interface-datastore'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export interface IPNSPublisherComponents {
  datastore: Datastore
  logger: ComponentLogger
  libp2p: Libp2p<{ keychain: Keychain }>
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
    this.keychain = components.libp2p.services.keychain
    this.localStore = init.localStore
    this.routers = init.routers
  }

  async publish (keyName: string, value: CID | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId | string, options: PublishOptions = {}): Promise<IPNSPublishResult> {
    try {
      const privKey = await this.#loadOrCreateKey(keyName)
      let sequenceNumber = 1n
      const routingKey = multihashToIPNSRoutingKey(privKey.publicKey.toMultihash())

      if (await this.localStore.has(routingKey, options)) {
        // if we have published under this key before, increment the sequence number
        const { record } = await this.localStore.get(routingKey, options)
        const existingRecord = unmarshalIPNSRecord(record)
        sequenceNumber = existingRecord.sequence + 1n
      }

      if (isPeerId(value)) {
        value = value.toCID()
      }

      // convert ttl from milliseconds to nanoseconds as createIPNSRecord expects
      const ttlNs = options.ttl != null ? BigInt(options.ttl) * 1_000_000n : DEFAULT_TTL_NS
      const lifetime = options.lifetime ?? DEFAULT_LIFETIME_MS
      const record = await createIPNSRecord(privKey, value, sequenceNumber, lifetime, { ...options, ttlNs })
      const marshaledRecord = marshalIPNSRecord(record)

      const metadata = { keyName, lifetime, upkeep: Upkeep[options.upkeep ?? 'republish'] }
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
        publicKey: privKey.publicKey
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:publish:error', err))
      throw err
    }
  }

  async #loadOrCreateKey (keyName: string): Promise<PrivateKey> {
    try {
      return await this.keychain.exportKey(keyName)
    } catch (err: any) {
      // If no named key found in keychain, generate and import
      const privKey = await generateKeyPair('Ed25519')
      await this.keychain.importKey(keyName, privKey)
      return privKey
    }
  }

  async unpublish (keyName: string | CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options?: AbortOptions): Promise<void> {
    if (typeof keyName === 'string') {
      const { publicKey } = await this.keychain.exportKey(keyName)
      keyName = publicKey.toMultihash()
    }

    const routingKey = multihashToIPNSRoutingKey(keyToMultihash(keyName))
    await this.localStore.delete(routingKey, options)
  }
}
