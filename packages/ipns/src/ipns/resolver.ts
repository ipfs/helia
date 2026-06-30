import { DEFAULT_TTL_NS } from '../constants.ts'
import { RecordNotFoundError, RecordsFailedValidationError } from '../errors.ts'
import { ipnsSelector } from '../selector.ts'
import { multihashToIPNSRoutingKey, unmarshalIPNSRecord, normalizeKey, IPNS_STRING_PREFIX } from '../utils.ts'
import { ipnsValidator } from '../validator.ts'
import type { IPNSRecord, IPNSResolveOptions, IPNSResolveResult } from '../index.ts'
import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting } from '../routing/index.ts'
import type { Routing, Keychain } from '@helia/interface'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { MultihashDigest } from 'multiformats/hashes/interface'

export interface IPNSResolverComponents {
  datastore: Datastore
  routing: Routing
  logger: ComponentLogger
  keychain: Keychain
}

export interface IPNResolverInit {
  localStore: LocalStore
  routers: IPNSRouting[]
}

export class IPNSResolver {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly log: Logger
  private keychain: Keychain

  constructor (components: IPNSResolverComponents, init: IPNResolverInit) {
    this.log = components.logger.forComponent('helia:ipns')
    this.localStore = init.localStore
    this.routers = init.routers
    this.keychain = components.keychain
  }

  async * resolve (key: MultihashDigest, options: IPNSResolveOptions = {}): AsyncGenerator<IPNSResolveResult> {
    let { digest } = normalizeKey(key)

    while (true) {
      const routingKey = multihashToIPNSRoutingKey(digest)
      const record = await this.#findIpnsRecord(routingKey, options)

      yield {
        record
      }

      if (!record.value.startsWith(IPNS_STRING_PREFIX)) {
        // not a recursive record
        break
      }

      ({ digest } = normalizeKey(record.value))
    }
  }

  async #findIpnsRecord (routingKey: Uint8Array, options: IPNSResolveOptions = {}): Promise<IPNSRecord> {
    const records: IPNSRecord[] = []
    const cached = await this.localStore.has(routingKey, options)

    if (cached) {
      this.log('record is present in the cache')

      if (options.nocache !== true) {
        try {
          // check the local cache first
          const { record: marshaledIPNSRecord, created } = await this.localStore.get(routingKey, options)

          this.log('record retrieved from cache')

          // unmarshal the record
          const ipnsRecord = await unmarshalIPNSRecord(routingKey, marshaledIPNSRecord, this.keychain, options)

          // validate the record
          await ipnsValidator(ipnsRecord, options)

          this.log('record was valid')

          // check the TTL

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
          records.push(ipnsRecord)
        } catch (err) {
          this.log('cached record was invalid - %e', err)
          await this.localStore.delete(routingKey, options)
        }
      } else {
        this.log('ignoring local cache due to nocache=true option')
      }
    }

    if (options.offline === true) {
      throw new RecordNotFoundError('Record was not present in the cache or has expired')
    }

    this.log('did not have record locally')

    let foundInvalid = 0
    const errors: Error[] = []

    await Promise.all(
      this.routers.map(async (router) => {
        let marshaledIPNSRecord: Uint8Array

        try {
          marshaledIPNSRecord = await router.get(routingKey, {
            ...options,
            validate: false
          })
        } catch (err: any) {
          this.log.error('error finding IPNS record using router %s - %e', router.toString(), err)
          errors.push(err)

          return
        }

        try {
          // unmarshal ensures that (1) SignatureV2 and Data are present, (2) that ValidityType
          // and Validity are of valid types and have a value, (3) that CBOR data matches protobuf
          // if it's a V1+V2 record
          const record = await unmarshalIPNSRecord(routingKey, marshaledIPNSRecord, this.keychain, options)

          await ipnsValidator(record, options)

          records.push(record)
        } catch (err) {
          // we found a record, but the validator rejected it
          foundInvalid++
          this.log.error('error validating IPNS record from router %s - %e', router.toString(), err)
        }
      })
    )

    if (records.length === 0) {
      if (foundInvalid > 0) {
        throw new RecordsFailedValidationError(`${foundInvalid > 1 ? `${foundInvalid} records` : 'Record'} found for routing key ${foundInvalid > 1 ? 'were' : 'was'} invalid`)
      }

      throw new RecordNotFoundError('Could not find record for routing key')
    }

    const record = records[ipnsSelector(routingKey, records)]

    await this.localStore.put(routingKey, record.bytes, options)

    return record
  }
}
