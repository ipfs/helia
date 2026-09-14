import { NotFoundError } from '@libp2p/interface'
import { Queue, repeatingTask } from '@libp2p/utils'
import NanoDate from 'timestamp-nano'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DEFAULT_REPUBLISH_CONCURRENCY, DEFAULT_REPUBLISH_INTERVAL_MS, DEFAULT_TTL_NS } from '../constants.ts'
import { RecordObsoleteError } from '../errors.ts'
import { IPNSEntry } from '../pb/ipns.ts'
import { Upkeep } from '../pb/metadata.ts'
import { createIPNSRecord } from '../records.ts'
import { isLocalStoreRouting, routerName } from '../routing/index.ts'
import { ipnsSelector } from '../selector.ts'
import { decodeExtensibleData, multihashToIPNSRoutingKey, shouldRepublish } from '../utils.ts'
import { extractPublicKey, ipnsValidator } from '../validator.ts'
import { findRoutingRecords } from './resolver.ts'
import type { IPNSRecordData, RepublishOptions, RepublishResult } from '../index.ts'
import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting, IPNSRoutingPutOptions } from '../routing/index.ts'
import type { Keychain, PrivateKey } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger } from '@libp2p/interface'
import type { RepeatingTask } from '@libp2p/utils'
import type { MultihashDigest } from 'multiformats'

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
      const recordsToReissue: Array<{ routingKey: Uint8Array, record: IPNSEntry }> = []
      const recordsToRebroadcast: Array<{ routingKey: Uint8Array, record: IPNSEntry }> = []
      let listed = 0

      // Find all records using the localStore.list method
      for await (const { routingKey, record, metadata, created } of this.localStore.list(options)) {
        listed++

        if (metadata == null) {
          // no metadata: an imported record not yet given an upkeep policy, or a
          // record stored before we tracked metadata
          this.log('no metadata found for record %b, skipping', routingKey)
          continue
        }

        if (metadata.upkeep === Upkeep.none) {
          // Skip republishing, disabled for this record
          this.log('republishing is disabled for record %b, skipping', routingKey)
          continue
        }

        let ipnsRecord: IPNSEntry

        try {
          ipnsRecord = IPNSEntry.decode(record)
        } catch (err) {
          // the record was valid when stored, so a decode failure now means
          // on-disk corruption or a format change worth surfacing
          this.log.error('skipping stored record %b, could not decode it - %e', routingKey, err)
          continue
        }

        if (ipnsRecord.data == null) {
          this.log.error('skipping stored record %b, its data is missing', routingKey)
          continue
        }

        let data: IPNSRecordData

        try {
          data = decodeExtensibleData(ipnsRecord.data)
        } catch (err) {
          this.log.error('skipping stored record %b, could not decode its data - %e', routingKey, err)
          continue
        }

        let recordExpiry: Date

        try {
          recordExpiry = NanoDate.fromString(uint8ArrayToString(data.Validity)).toDate()
        } catch (err) {
          this.log.error('skipping stored record %b, could not parse its validity - %e', routingKey, err)
          continue
        }

        // Only republish records that are within the DHT or record expiry threshold
        if (!shouldRepublish(created, recordExpiry)) {
          this.log.trace('skipping record %b within republish threshold', routingKey)
          continue
        }

        if (metadata.upkeep === Upkeep.rebroadcast) {
          // only re-broadcast records that are still valid: an expired record
          // cannot be revived without re-signing, which the rebroadcast policy
          // has no key for
          if (recordExpiry.getTime() <= Date.now()) {
            this.log.trace('skipping expired record %b for rebroadcast', routingKey)
            continue
          }

          recordsToRebroadcast.push({ routingKey, record: ipnsRecord })
          continue
        }

        // Upkeep.reissue: re-sign the record with a new validity
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

          recordsToReissue.push({
            routingKey,
            record: updatedRecord
          })
        } catch (err: any) {
          this.log.error('error creating updated IPNS record for %b - %e', routingKey, err)
          continue
        }
      }

      this.log(`reissuing ${recordsToReissue.length} and rebroadcasting ${recordsToRebroadcast.length} of ${listed} records`)

      // reissue: re-publish the re-signed record as-is. the jobs run
      // fire-and-forget, so catch any failure (including a local-store write
      // that #publishToRouters surfaces) rather than leaving an unhandled rejection
      for (const { routingKey, record } of recordsToReissue) {
        queue.add(async () => this.#publishToRouters(routingKey, IPNSEntry.encode(record), options), options)
          .catch((err: any) => { this.log.error('failed to reissue record %b - %e', routingKey, err) })
      }

      // rebroadcast: resolve the latest record from the network and re-broadcast
      // whichever of the local and network records is most suitable, so we adopt
      // a newer record rather than pushing a stale local copy
      for (const { routingKey, record } of recordsToRebroadcast) {
        queue.add(async () => {
          const { records } = await findRoutingRecords(this.routers, routingKey, this.keychain, this.log, options)
          const candidates = [record, ...records]
          const best = candidates[ipnsSelector(routingKey, candidates)]

          await this.#publishToRouters(routingKey, IPNSEntry.encode(best), { ...options, overwrite: true })
        }, options)
          .catch((err: any) => { this.log.error('failed to rebroadcast record %b - %e', routingKey, err) })
      }
    } catch (err: any) {
      this.log.error('error during republish - %e', err)
    }
  }

  /**
   * Persist the record to the local store first, throwing if that fails: it
   * holds the record and its upkeep policy, so that failure must surface rather
   * than be swallowed. Then broadcast to the network routers best-effort,
   * logging any that fail.
   */
  async #publishToRouters (routingKey: Uint8Array, marshaledRecord: Uint8Array, putOptions: IPNSRoutingPutOptions): Promise<void> {
    const localStoreRouter = this.routers.find(isLocalStoreRouting)

    if (localStoreRouter != null) {
      await localStoreRouter.put(routingKey, marshaledRecord, putOptions)
      this.log('published record %b to %s', routingKey, routerName(localStoreRouter))
    }

    await Promise.all(
      this.routers
        .filter(router => router !== localStoreRouter)
        .map(async (router) => {
          try {
            await router.put(routingKey, marshaledRecord, putOptions)
            this.log('published record %b to %s', routingKey, routerName(router))
          } catch (err) {
            this.log.error('failed to publish record %b to %s - %e', routingKey, routerName(router), err)
          }
        })
    )
  }

  async republish (key: MultihashDigest, options: RepublishOptions = {}): Promise<RepublishResult> {
    const routingKey = multihashToIPNSRoutingKey(key)

    // read the record we hold for this key directly, it was validated when it
    // was imported or published, and reading it through resolve() would recurse
    // and rewrite the local store
    let record: Uint8Array<ArrayBuffer>

    try {
      ({ record } = await this.localStore.get(routingKey, options))
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        throw err
      }

      throw new NotFoundError('No local record found to republish - import it first')
    }

    // re-validate: a record that was valid when stored can have expired since
    const localRecord = await ipnsValidator(routingKey, record, this.keychain, options)

    // unless we are told not to look, check whether the routing already has a
    // more suitable record; if so, back off
    if (options.skipResolution !== true) {
      const { records } = await findRoutingRecords(this.routers, routingKey, this.keychain, this.log, options)
      const candidates = [localRecord, ...records]
      const best = ipnsSelector(routingKey, candidates)

      if (best !== 0) {
        throw new RecordObsoleteError('A newer record is already published for this key', candidates[best])
      }
    }

    const metadata = {
      upkeep: Upkeep[options.upkeep ?? 'rebroadcast']
    }

    // a publish that fails on every router does not throw; use onProgress to see
    // which routers worked and watch the logs
    await this.#publishToRouters(routingKey, record, {
      ...options,
      overwrite: true,
      metadata
    })

    return {
      record: localRecord,
      publicKey: await extractPublicKey(routingKey, localRecord, this.keychain, options)
    }
  }

  async import (key: MultihashDigest, record: IPNSEntry | Uint8Array, options?: AbortOptions): Promise<void> {
    const routingKey = multihashToIPNSRoutingKey(key)
    const entry = record instanceof Uint8Array ? IPNSEntry.decode(record) : record
    const marshaledRecord = IPNSEntry.encode(entry)

    // validate the record, throws if it is invalid (bad signature, expired, etc)
    await ipnsValidator(routingKey, marshaledRecord, this.keychain, options)

    // do not downgrade a record we already hold
    try {
      const { record: existingBytes } = await this.localStore.get(routingKey, options)
      const existing = IPNSEntry.decode(existingBytes)

      // if the record we already have wins the selector, the incoming one is obsolete
      if (ipnsSelector(routingKey, [entry, existing]) !== 0) {
        throw new RecordObsoleteError('A newer record is already stored for this key', existing)
      }
    } catch (err: any) {
      // holding no record for this key is the normal case, everything else
      // (the RecordObsoleteError above included) is a real failure
      if (err.name !== 'NotFoundError') {
        throw err
      }
    }

    // store the record locally only, without metadata, so it is served but not
    // automatically republished until republish() gives it an upkeep policy
    await this.localStore.put(routingKey, marshaledRecord, options)
  }
}
