import { NotFoundError, isPeerId, isPublicKey } from '@libp2p/interface'
import { multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { base36 } from 'multiformats/bases/base36'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { DEFAULT_TTL_NS } from '../constants.ts'
import { InvalidValueError, RecordsFailedValidationError, UnsupportedMultibasePrefixError, UnsupportedMultihashCodecError } from '../errors.js'
import { isCodec, IDENTITY_CODEC, SHA2_256_CODEC, isLibp2pCID } from '../utils.js'
import { LocalStoreRouting } from '../routing/local-store.ts'
import type { IPNSResolveResult, ResolveOptions, ResolveResult } from '../index.js'
import type { LocalStore } from '../local-store.js'
import type { IPNSRouting } from '../routing/index.js'
import type { Routing } from '@helia/interface'
import type { ComponentLogger, Logger, PeerId, PublicKey } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { IPNSRecord } from 'ipns'
import type { MultibaseDecoder } from 'multiformats/bases/interface'
import type { MultihashDigest } from 'multiformats/hashes/interface'

const bases: Record<string, MultibaseDecoder<string>> = {
  [base36.prefix]: base36,
  [base58btc.prefix]: base58btc
}

export interface IPNSResolverComponents {
  datastore: Datastore
  routing: Routing
  logger: ComponentLogger
}

export interface IPNResolverInit {
  localStore: LocalStore
  routers: IPNSRouting[]
}

export class IPNSResolver {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly log: Logger

  constructor (components: IPNSResolverComponents, init: IPNResolverInit) {
    this.log = components.logger.forComponent('helia:ipns')
    this.localStore = init.localStore
    this.routers = init.routers
  }

  async resolve (key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: ResolveOptions = {}): Promise<IPNSResolveResult> {
    const digest = isPublicKey(key) || isPeerId(key) ? key.toMultihash() : isLibp2pCID(key) ? key.multihash : key
    const routingKey = multihashToIPNSRoutingKey(digest)
    const record = await this.#findIpnsRecord(routingKey, options)

    return {
      ...(await this.#resolve(record.value, options)),
      record
    }
  }

  async #resolve (ipfsPath: string, options: ResolveOptions = {}): Promise<ResolveResult> {
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
          path: path === '' ? undefined : path
        }
      } else if (scheme === 'ipfs') {
        const cid = CID.parse(parts[2])
        const path = parts.slice(3).join('/')

        return {
          cid,
          path: path === '' ? undefined : path
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

        // skip checking cache when nocache is true
        if (router instanceof LocalStoreRouting && options.nocache === true) {
          return
        }

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
