import { Queue, repeatingTask } from '@libp2p/utils'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DEFAULT_REPUBLISH_CONCURRENCY, DEFAULT_REPUBLISH_INTERVAL_MS, DEFAULT_TTL_NS } from '../constants.ts'
import { IPNSEntry } from '../pb/ipns.ts'
import { createIPNSRecord } from '../records.ts'
import { decodeExtensibleData, shouldRepublish } from '../utils.ts'
import type { IPNSRecordData } from '../index.ts'
import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting } from '../routing/index.ts'
import type { Keychain, PrivateKey } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger } from '@libp2p/interface'
import type { RepeatingTask } from '@libp2p/utils'

export interface IPNSRepublisherComponents {
  logger: ComponentLogger
  keychain: Keychain
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
    this.keychain = components.keychain
    this.republishConcurrency = init.republishConcurrency || DEFAULT_REPUBLISH_CONCURRENCY
    this.started = false
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
      const recordsToRepublish: Array<{ routingKey: Uint8Array, record: IPNSEntry }> = []
      let listed = 0

      // Find all records using the localStore.list method
      for await (const { routingKey, record, metadata, created } of this.localStore.list(options)) {
        listed++

        if (metadata == null) {
          // Skip if no metadata is found from before we started
          // storing metadata or for records republished without a key
          this.log('no metadata found for record %b, skipping', routingKey)
          continue
        }

        let ipnsRecord: IPNSEntry

        try {
          ipnsRecord = IPNSEntry.decode(record)
        } catch (err) {
          this.log.trace('skipping invalid record %b because could not decode', routingKey)
          continue
        }

        if (ipnsRecord.data == null) {
          this.log.trace('skipping record %b because data was missing', routingKey)
          continue
        }

        let data: IPNSRecordData

        try {
          data = decodeExtensibleData(ipnsRecord.data)
        } catch {
          this.log.trace('skipping record %b because could not decode data', routingKey)
          continue
        }

        // Only republish records that are within the DHT or record expiry threshold
        if (!shouldRepublish(created, new Date(uint8ArrayToString(data.Validity)))) {
          this.log.trace('skipping record %b within republish threshold', routingKey)
          continue
        }

        const sequenceNumber = data.Sequence + 1n
        const ttlNs = data.TTL ?? DEFAULT_TTL_NS
        let privKey: PrivateKey

        try {
          privKey = await this.keychain.exportKey(metadata.keyName)
        } catch (err: any) {
          this.log.error('missing key %s, skipping republishing record - %e', metadata.keyName, err)
          continue
        }

        try {
          const updatedRecord = await createIPNSRecord(privKey, uint8ArrayToString(data.Value), sequenceNumber, metadata.lifetime, {
            ...options,
            ttlNs
          })
          recordsToRepublish.push({
            routingKey,
            record: updatedRecord
          })
        } catch (err: any) {
          this.log.error('error creating updated IPNS record for %s - %e', routingKey, err)
          continue
        }
      }

      this.log(`found ${recordsToRepublish.length}/${listed} records to republish`)

      // Republish each record
      for (const { routingKey, record } of recordsToRepublish) {
        // Add job to queue to republish the record to all routers
        queue.add(async () => {
          try {
            const marshaledRecord = IPNSEntry.encode(record)
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
}
