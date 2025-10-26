import { Queue, repeatingTask } from '@libp2p/utils'
import { createIPNSRecord, marshalIPNSRecord, multihashFromIPNSRoutingKey, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import { DEFAULT_REPUBLISH_CONCURRENCY, DEFAULT_REPUBLISH_INTERVAL_MS, DEFAULT_TTL_NS } from '../constants.ts'
import { keyToMultihash, shouldRefresh, shouldRepublish } from '../utils.js'
import type { ListResult, LocalStore } from '../local-store.js'
import type { IPNSRouting } from '../routing/index.js'
import { NotFoundError, type AbortOptions, type ComponentLogger, type Libp2p, type Logger, type PeerId, type PrivateKey, type PublicKey } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { RepeatingTask } from '@libp2p/utils'
import type { IPNSRecord } from 'ipns'
import { ipnsValidator } from 'ipns/validator'
import { ipnsSelector, type IPNSRefreshResult, type RefreshOptions } from '../index.ts'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import type { CID, MultihashDigest } from 'multiformats/cid'
import type { IPNSResolver } from './resolver.ts'

export interface IPNSRepublisherComponents {
  logger: ComponentLogger
  libp2p: Libp2p<{ keychain: Keychain }>
}

export interface IPNSRepublisherInit {
  republishConcurrency?: number
  republishInterval?: number
  resolver: IPNSResolver
  routers: IPNSRouting[]
  localStore: LocalStore
}

export class IPNSRepublisher {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly resolver: IPNSResolver
  private readonly republishTask: RepeatingTask
  private readonly log: Logger
  private readonly keychain: Keychain
  private started: boolean = false
  private readonly republishConcurrency: number

  constructor (components: IPNSRepublisherComponents, init: IPNSRepublisherInit) {
    this.log = components.logger.forComponent('helia:ipns')
    this.localStore = init.localStore
    this.resolver = init.resolver
    this.keychain = components.libp2p.services.keychain
    this.republishConcurrency = init.republishConcurrency || DEFAULT_REPUBLISH_CONCURRENCY
    this.started = components.libp2p.status === 'started'
    this.routers = init.routers ?? []

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
      const recordsToRefresh: Array<Omit<ListResult, 'record'>> = []

      // Find all records using the localStore.list method
      for await (const { routingKey, record, metadata, created } of this.localStore.list(options)) {
        if (metadata == null) {
          // Skip if no metadata is found from before we started
          // storing metadata or for records republished without a key
          this.log(`no metadata found for record ${routingKey.toString()}, skipping`)
          continue
        }

        if (metadata.refresh) {
          // processing records to refresh may require writing to localStore
          // so that is done outside of query iterator
          recordsToRefresh.push({ routingKey, created })
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
          this.log.error(`missing key ${metadata.keyName}, skipping republishing record for ${routingKey.toString()}`, err)
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

      // Republish or refresh each record
      for (const { routingKey, record } of recordsToRepublish) {
        // Add job to queue to republish the record to all routers
        queue.add(async () => {
          try {
            await Promise.all(
              this.routers.map(r => r.put(routingKey, marshalIPNSRecord(record), options))
            )
          } catch (err: any) {
            this.log.error('error republishing record - %e', err)
          }
        }, options)
      }
      for (const { routingKey, created } of recordsToRefresh) {
        // resolve the latest record
        let latestRecord: IPNSRecord
        try {
          const { record } = await this.resolver.resolve(multihashFromIPNSRoutingKey(routingKey))
          latestRecord = record
        } catch (err: any) {
          this.log.error('unable to find record to refresh - %e', err)
          continue
        }

        if (!shouldRefresh(created)) {
          this.log.trace(`skipping record ${routingKey.toString()} within republish threshold`)
          continue
        }

        // Add job to queue to refresh the record to all routers
        queue.add(async () => {
          try {
            await Promise.all(
              this.routers.map(r => r.put(routingKey, marshalIPNSRecord(latestRecord), { ...options, overwrite: true }))
            )
          } catch (err: any) {
            this.log.error('error refreshing record - %e', err)
          }
        }, options)
      }
    } catch (err: any) {
      this.log.error('error during republish - %e', err)
    }

    await queue.onIdle(options) // Wait for all jobs to complete
  }

  async refresh(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: RefreshOptions = {}): Promise<IPNSRefreshResult> {
    let records: IPNSRecord[] = []
    let publishedRecord: IPNSRecord | null = null
    const digest = keyToMultihash(key)
    const routingKey = multihashToIPNSRoutingKey(digest)

    // collect records for key
    if (options.record != null) {
      // add user supplied record
      await ipnsValidator(routingKey, marshalIPNSRecord(options.record))
      records.push(options.record)
    }
    try {
      // add local record
      const { record } = await this.resolver.resolve(key, { offline: true })
      records.push(record)
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        throw err
      }
    }
    try {
      // add published record
      const { record } = await this.resolver.resolve(key)
      publishedRecord = record
      records.push(record)
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        throw err
      }
    }

    if (records.length === 0) {
      throw new NotFoundError(`Found no records to refresh for key ${routingKey.toString()}`)
    }

    // check if record is already published
    const selectedRecord = records[ipnsSelector(routingKey, records.map(marshalIPNSRecord))]
    const marshaledRecord = marshalIPNSRecord(selectedRecord)
    if (options.force !== true && publishedRecord != null && uint8ArrayEquals(marshaledRecord, marshalIPNSRecord(publishedRecord))) {
      throw new Error('The record is already being published')
    }

    // publish record to routers
    try {
      // overwrite so Record.created is reset for #republish
      const putOptions = {
        ...options,
        metadata: options.repeat ? { refresh: true } : undefined,
        overwrite: true
      }
      await Promise.all(
        this.routers.map(r => r.put(routingKey, marshaledRecord, putOptions))
      )
    } catch (err: any) {
      this.log.error('error republishing record - %e', err)
    }

    return { record: selectedRecord }
  }

  async unrefresh(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options: AbortOptions = {}): Promise<void> {
    const routingKey = multihashToIPNSRoutingKey(keyToMultihash(key))
    await this.localStore.delete(routingKey)
  }
}
