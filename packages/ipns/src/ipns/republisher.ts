import { Queue, repeatingTask } from '@libp2p/utils'
import { createIPNSRecord, marshalIPNSRecord, unmarshalIPNSRecord } from 'ipns'
import { DEFAULT_REPUBLISH_CONCURRENCY, DEFAULT_REPUBLISH_INTERVAL_MS, DEFAULT_TTL_NS } from '../constants.ts'
import { shouldRefresh, shouldRepublish } from '../utils.js'
import type { LocalStore } from '../local-store.js'
import type { IPNSRouting } from '../routing/index.js'
import type { AbortOptions, ComponentLogger, Libp2p, Logger, PrivateKey } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { RepeatingTask } from '@libp2p/utils'
import type { IPNSRecord } from 'ipns'
import { ipnsValidator } from 'ipns/validator'
import type { IPNSRecordMetadata } from '../index.ts'

export interface IPNSRepublisherComponents {
  logger: ComponentLogger
  libp2p: Libp2p<{ keychain: Keychain }>
}

export interface IPNSRepublisherInit {
  republishConcurrency?: number
  republishInterval?: number
  routers: IPNSRouting[]
  localStore: LocalStore
}

export class IPNSRepublisher {
  public readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private readonly republishTask: RepeatingTask
  private readonly log: Logger
  private readonly keychain: Keychain
  private started: boolean = false
  private readonly republishConcurrency: number

  constructor (components: IPNSRepublisherComponents, init: IPNSRepublisherInit) {
    this.log = components.logger.forComponent('helia:ipns')
    this.localStore = init.localStore
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
      const recordsToRepublish: Array<{ routingKey: Uint8Array, record: Uint8Array, overwrite?: boolean }> = []

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

        if (metadata.refresh) {
          try {
            await ipnsValidator(routingKey, record)
          } catch (err: any) {
            this.log('unable to refresh expired record - %e', err)
            await this.localStore.delete(routingKey, options)
            continue
          }
          if (shouldRefresh(created)) {
            recordsToRepublish.push({ routingKey, record, overwrite: true })
          } else {
            this.log.trace(`skipping record ${routingKey.toString()} within republish threshold`)
          }
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
          recordsToRepublish.push({ routingKey, record: marshalIPNSRecord(updatedRecord) })
        } catch (err: any) {
          this.log.error(`error creating updated IPNS record for ${routingKey.toString()}`, err)
          continue
        }
      }

      this.log(`found ${recordsToRepublish.length} records to republish`)

      // Republish each record
      for (const { routingKey, record, overwrite } of recordsToRepublish) {
        // Add job to queue to republish the record to all routers
        queue.add(async () => {
          try {
            await Promise.all(
              this.routers.map(r => r.put(routingKey, record, { ...options, overwrite }))
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
}
