import { generateKeyPair } from '@libp2p/crypto/keys'
import { NotFoundError, NotStartedError, isPeerId, isPublicKey } from '@libp2p/interface'
import { Queue, repeatingTask } from '@libp2p/utils'
import { createIPNSRecord, marshalIPNSRecord, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { base36 } from 'multiformats/bases/base36'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { CustomProgressEvent } from 'progress-events'
import { DEFAULT_LIFETIME_MS, DEFAULT_REPUBLISH_CONCURRENCY, DEFAULT_REPUBLISH_INTERVAL_MS, DEFAULT_TTL_NS } from './constants.ts'
import { InvalidValueError, RecordsFailedValidationError, UnsupportedMultibasePrefixError, UnsupportedMultihashCodecError } from './errors.js'
import { localStore } from './local-store.js'
import { helia } from './routing/helia.js'
import { localStoreRouting } from './routing/local-store.ts'
import { isCodec, IDENTITY_CODEC, SHA2_256_CODEC, shouldRepublish, isLibp2pCID } from './utils.js'
import type { IPNSComponents, IPNS as IPNSInterface, IPNSOptions, IPNSPublishResult, IPNSResolveResult, PublishOptions, ResolveOptions } from './index.js'
import type { LocalStore } from './local-store.js'
import type { IPNSRouting } from './routing/index.js'
import type { AbortOptions, Logger, PeerId, PrivateKey, PublicKey, Startable } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { RepeatingTask } from '@libp2p/utils'
import type { IPNSRecord } from 'ipns'
import type { MultibaseDecoder } from 'multiformats/bases/interface'
import type { MultihashDigest } from 'multiformats/hashes/interface'

const bases: Record<string, MultibaseDecoder<string>> = {
  [base36.prefix]: base36,
  [base58btc.prefix]: base58btc
}

export class IPNS implements IPNSInterface, Startable {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly republishTask: RepeatingTask
  private readonly log: Logger
  private readonly keychain: Keychain
  private started: boolean = false
  private readonly republishConcurrency: number

  constructor (components: IPNSComponents, init: IPNSOptions = {}) {
    this.log = components.logger.forComponent('helia:ipns')
    this.localStore = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
    this.keychain = components.libp2p.services.keychain
    this.republishConcurrency = init.republishConcurrency || DEFAULT_REPUBLISH_CONCURRENCY
    this.started = components.libp2p.status === 'started'

    this.routers = [
      localStoreRouting(this.localStore),
      helia(components.routing),
      ...(init.routers ?? [])
    ]

    // start republishing on Helia start
    components.events.addEventListener('start', this.start.bind(this))
    // stop republishing on Helia stop
    components.events.addEventListener('stop', this.stop.bind(this))

    this.republishTask = repeatingTask(this.#republish.bind(this), init.republishInterval ?? DEFAULT_REPUBLISH_INTERVAL_MS, {
      runImmediately: true
    })

    if (this.started) {
      this.republishTask.start()
    }
  }

  start (): void {
    if (this.started) {
      return
    }

    this.started = true
    this.republishTask.start()
  }

  stop (): void {
    if (!this.started) {
      return
    }

    this.started = false
    this.republishTask.stop()
  }

  #throwIfStopped (): void {
    if (!this.started) {
      throw new NotStartedError('Helia is stopped, cannot perform IPNS operations')
    }
  }

  async publish (keyName: string, value: CID | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId | string, options: PublishOptions = {}): Promise<IPNSPublishResult> {
    this.#throwIfStopped()

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

      if (options.offline === true) {
        // only store record locally
        await this.localStore.put(routingKey, marshaledRecord, { ...options, metadata: { keyName, lifetime } })
      } else {
        // publish record to routing (including the local store)
        await Promise.all(this.routers.map(async r => {
          await r.put(routingKey, marshaledRecord, { ...options, metadata: { keyName, lifetime } })
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

  async resolve (key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: ResolveOptions = {}): Promise<IPNSResolveResult> {
    this.#throwIfStopped()
    const digest = isPublicKey(key) || isPeerId(key) ? key.toMultihash() : isLibp2pCID(key) ? key.multihash : key
    const routingKey = multihashToIPNSRoutingKey(digest)
    const record = await this.#findIpnsRecord(routingKey, options)

    return {
      ...(await this.#resolve(record.value, options)),
      record
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

  async #republish (options: AbortOptions = {}): Promise<void> {
    if (!this.started) {
      return
    }

    this.log('starting ipns republish records loop')

    const queue = new Queue({
      concurrency: this.republishConcurrency
    })

    try {
      const recordsToRepublish: Array<{ routingKey: Uint8Array, record: IPNSRecord }> = []

      // Find all records using the localStore.list method
      for await (const { routingKey, record, metadata, created } of this.localStore.list(options)) {
        if (metadata == null) {
          // Skip if no metadata is found from before we started
          // storing metadata or for records republished without a key
          this.log(`no metadata found for record ${routingKey.toString()}, skipping`)
          continue
        }
        let ipnsRecord: IPNSRecord
        try {
          ipnsRecord = unmarshalIPNSRecord(record)
        } catch (err: any) {
          this.log.error('error unmarshaling record - %e', err)
          continue
        }

        // Only republish records that are within the DHT or record expiry threshold
        if (!shouldRepublish(ipnsRecord, created)) {
          this.log.trace(`skipping record ${routingKey.toString()}within republish threshold`)
          continue
        }
        const sequenceNumber = ipnsRecord.sequence + 1n
        const ttlNs = ipnsRecord.ttl ?? DEFAULT_TTL_NS
        let privKey: PrivateKey

        try {
          privKey = await this.keychain.exportKey(metadata.keyName)
        } catch (err: any) {
          this.log.error(`missing key ${metadata.keyName}, skipping republishing record`, err)
          continue
        }
        try {
          const updatedRecord = await createIPNSRecord(privKey, ipnsRecord.value, sequenceNumber, metadata.lifetime, { ...options, ttlNs })
          recordsToRepublish.push({ routingKey, record: updatedRecord })
        } catch (err: any) {
          this.log.error(`error creating updated IPNS record for ${routingKey.toString()}`, err)
          continue
        }
      }

      this.log(`found ${recordsToRepublish.length} records to republish`)

      // Republish each record
      for (const { routingKey, record } of recordsToRepublish) {
        // Add job to queue to republish the record to all routers
        queue.add(async () => {
          try {
            const marshaledRecord = marshalIPNSRecord(record)
            await Promise.all(
              this.routers.map(r => r.put(routingKey, marshaledRecord, options))
            )
          } catch (err: any) {
            this.log.error('error republishing record - %e', err)
          }
        }, options)
      }
    } catch (err: any) {
      this.log.error('error during republish - %e', err)
    }

    await queue.onIdle(options) // Wait for all jobs to complete
  }

  async unpublish (keyName: string, options?: AbortOptions): Promise<void> {
    const { publicKey } = await this.keychain.exportKey(keyName)
    const digest = publicKey.toMultihash()
    const routingKey = multihashToIPNSRoutingKey(digest)
    await this.localStore.delete(routingKey, options)
  }

  async #resolve (ipfsPath: string, options: ResolveOptions = {}): Promise<{ cid: CID, path: string }> {
    const parts = ipfsPath.split('/')
    try {
      const scheme = parts[1]

      if (scheme === 'ipns') {
        const str = parts[2]
        const prefix = str.substring(0, 1)
        let buf: Uint8Array | undefined

        if (prefix === '1' || prefix === 'Q') {
          buf = base58btc.decode(`z${str}`)
        } else if (bases[prefix] != null) {
          buf = bases[prefix].decode(str)
        } else {
          throw new UnsupportedMultibasePrefixError(`Unsupported multibase prefix "${prefix}"`)
        }

        let digest: MultihashDigest<number>

        try {
          digest = Digest.decode(buf)
        } catch {
          digest = CID.decode(buf).multihash
        }

        if (!isCodec(digest, IDENTITY_CODEC) && !isCodec(digest, SHA2_256_CODEC)) {
          throw new UnsupportedMultihashCodecError(`Unsupported multihash codec "${digest.code}"`)
        }

        const { cid } = await this.resolve(digest, options)
        const path = parts.slice(3).join('/')
        return {
          cid,
          path
        }
      } else if (scheme === 'ipfs') {
        const cid = CID.parse(parts[2])
        const path = parts.slice(3).join('/')
        return {
          cid,
          path
        }
      }
    } catch (err) {
      this.log.error('error parsing ipfs path - %e', err)
    }

    this.log.error('invalid ipfs path %s', ipfsPath)
    throw new InvalidValueError('Invalid value')
  }

  async #findIpnsRecord (routingKey: Uint8Array, options: ResolveOptions = {}): Promise<IPNSRecord> {
    const records: Uint8Array[] = []
    const cached = await this.localStore.has(routingKey, options)

    if (cached) {
      this.log('record is present in the cache')

      if (options.nocache !== true) {
        try {
          // check the local cache first
          const { record, created } = await this.localStore.get(routingKey, options)

          this.log('record retrieved from cache')

          // validate the record
          await ipnsValidator(routingKey, record)

          this.log('record was valid')

          // check the TTL
          const ipnsRecord = unmarshalIPNSRecord(record)

          // IPNS TTL is in nanoseconds, convert to milliseconds, default to one
          // hour
          const ttlMs = Number((ipnsRecord.ttl ?? DEFAULT_TTL_NS) / 1_000_000n)
          const ttlExpires = created.getTime() + ttlMs

          if (ttlExpires > Date.now()) {
            // the TTL has not yet expired, return the cached record
            this.log('record TTL was valid')
            return ipnsRecord
          }

          if (options.offline === true) {
            // the TTL has expired but we are skipping the routing search
            this.log('record TTL has been reached but we are resolving offline-only, returning record')
            return ipnsRecord
          }

          this.log('record TTL has been reached, searching routing for updates')

          // add the local record to our list of resolved record, and also
          // search the routing for updates - the most up to date record will be
          // returned
          records.push(record)
        } catch (err) {
          this.log('cached record was invalid - %e', err)
          await this.localStore.delete(routingKey, options)
        }
      } else {
        this.log('ignoring local cache due to nocache=true option')
      }
    }

    if (options.offline === true) {
      throw new NotFoundError('Record was not present in the cache or has expired')
    }

    this.log('did not have record locally')

    let foundInvalid = 0

    await Promise.all(
      this.routers.map(async (router) => {
        let record: Uint8Array

        try {
          record = await router.get(routingKey, {
            ...options,
            validate: false
          })
        } catch (err: any) {
          this.log.error('error finding IPNS record - %e', err)

          return
        }

        try {
          await ipnsValidator(routingKey, record)

          records.push(record)
        } catch (err) {
          // we found a record, but the validator rejected it
          foundInvalid++
          this.log.error('error finding IPNS record - %e', err)
        }
      })
    )

    if (records.length === 0) {
      if (foundInvalid > 0) {
        throw new RecordsFailedValidationError(`${foundInvalid > 1 ? `${foundInvalid} records` : 'Record'} found for routing key ${foundInvalid > 1 ? 'were' : 'was'} invalid`)
      }

      throw new NotFoundError('Could not find record for routing key')
    }

    const record = records[ipnsSelector(routingKey, records)]

    await this.localStore.put(routingKey, record, options)

    return unmarshalIPNSRecord(record)
  }
}
