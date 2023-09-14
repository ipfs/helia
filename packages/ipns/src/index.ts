/**
 * @packageDocumentation
 *
 * IPNS operations using a Helia node
 *
 * @example
 *
 * ```typescript
 * import { gossipsub } from '@chainsafe/libp2p-gossipsub'
 * import { kadDHT } from '@libp2p/kad-dht'
 * import { createLibp2p } from 'libp2p'
 * import { createHelia } from 'helia'
 * import { ipns, ipnsValidator, ipnsSelector } from '@helia/ipns'
 * import { dht, pubsub } from '@helia/ipns/routing'
 * import { unixfs } from '@helia/unixfs'
 *
 * const libp2p = await createLibp2p({
 *   dht: kadDHT({
 *    validators: {
 *      ipns: ipnsValidator
 *    },
 *    selectors: {
 *      ipns: ipnsSelector
 *    }
 *   }),
 *   pubsub: gossipsub()
 * })
 *
 * const helia = await createHelia({
 *   libp2p,
 *   //.. other options
 * })
 * const name = ipns(helia, [
 *   dht(helia),
 *   pubsub(helia)
 * ])
 *
 * // create a public key to publish as an IPNS name
 * const keyInfo = await helia.libp2p.keychain.createKey('my-key')
 * const peerId = await helia.libp2p.keychain.exportPeerId(keyInfo.name)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * await name.publish(peerId, cid)
 *
 * // resolve the name
 * const cid = name.resolve(peerId)
 * ```
 *
 * @example
 *
 * ```typescript
 * // resolve a CID from a TXT record in a DNS zone file, eg:
 * // > dig ipfs.io TXT
 * // ;; ANSWER SECTION:
 * // ipfs.io.           435     IN      TXT     "dnslink=/ipfs/Qmfoo"
 *
 * const cid = name.resolveDns('ipfs.io')
 * ```
 */

import { CodeError } from '@libp2p/interface/errors'
import { isPeerId, type PeerId } from '@libp2p/interface/peer-id'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { create, marshal, peerIdToRoutingKey, unmarshal } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { localStore, type LocalStore } from './routing/local-store.js'
import { resolveDnslink } from './utils/resolve-dns-link.js'
import type { IPNSRouting, IPNSRoutingEvents } from './routing/index.js'
import type { AbortOptions } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { IPNSEntry } from 'ipns'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

const log = logger('helia:ipns')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

const DEFAULT_LIFETIME_MS = 24 * HOUR
const DEFAULT_REPUBLISH_INTERVAL_MS = 23 * HOUR

export type PublishProgressEvents =
  ProgressEvent<'ipns:publish:start'> |
  ProgressEvent<'ipns:publish:success', IPNSEntry> |
  ProgressEvent<'ipns:publish:error', Error>

export type ResolveProgressEvents =
  ProgressEvent<'ipns:resolve:start', unknown> |
  ProgressEvent<'ipns:resolve:success', IPNSEntry> |
  ProgressEvent<'ipns:resolve:error', Error>

export type RepublishProgressEvents =
  ProgressEvent<'ipns:republish:start', unknown> |
  ProgressEvent<'ipns:republish:success', IPNSEntry> |
  ProgressEvent<'ipns:republish:error', { record: IPNSEntry, err: Error }>

export interface PublishOptions extends AbortOptions, ProgressOptions<PublishProgressEvents | IPNSRoutingEvents> {
  /**
   * Time duration of the record in ms (default: 24hrs)
   */
  lifetime?: number

  /**
   * Only publish to a local datastore (default: false)
   */
  offline?: boolean
}

export interface ResolveOptions extends AbortOptions, ProgressOptions<ResolveProgressEvents | IPNSRoutingEvents> {
  /**
   * Do not query the network for the IPNS record (default: false)
   */
  offline?: boolean
}

export interface ResolveDNSOptions extends ResolveOptions {
  /**
   * Do not use cached DNS entries (default: false)
   */
  nocache?: boolean
}

export interface RepublishOptions extends AbortOptions, ProgressOptions<RepublishProgressEvents | IPNSRoutingEvents> {
  /**
   * The republish interval in ms (default: 23hrs)
   */
  interval?: number
}

export interface IPNS {
  /**
   * Creates an IPNS record signed by the passed PeerId that will resolve to the passed value
   *
   * If the valid is a PeerId, a recursive IPNS record will be created.
   */
  publish: (key: PeerId, value: CID | PeerId, options?: PublishOptions) => Promise<IPNSEntry>

  /**
   * Accepts a public key formatted as a libp2p PeerID and resolves the IPNS record
   * corresponding to that public key until a value is found
   */
  resolve: (key: PeerId, options?: ResolveOptions) => Promise<CID>

  /**
   * Resolve a CID from a dns-link style IPNS record
   */
  resolveDns: (domain: string, options?: ResolveDNSOptions) => Promise<CID>

  /**
   * Periodically republish all IPNS records found in the datastore
   */
  republish: (options?: RepublishOptions) => void
}

export type { IPNSRouting } from './routing/index.js'

export interface IPNSComponents {
  datastore: Datastore
}

class DefaultIPNS implements IPNS {
  private readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private timeout?: ReturnType<typeof setTimeout>

  constructor (components: IPNSComponents, routers: IPNSRouting[] = []) {
    this.routers = routers
    this.localStore = localStore(components.datastore)
  }

  async publish (key: PeerId, value: CID | PeerId, options: PublishOptions = {}): Promise<IPNSEntry> {
    try {
      let sequenceNumber = 1n
      const routingKey = peerIdToRoutingKey(key)

      if (await this.localStore.has(routingKey, options)) {
        // if we have published under this key before, increment the sequence number
        const buf = await this.localStore.get(routingKey, options)
        const existingRecord = unmarshal(buf)
        sequenceNumber = existingRecord.sequence + 1n
      }

      let str

      if (isPeerId(value)) {
        str = `/ipns/${value.toString()}`
      } else {
        str = `/ipfs/${value.toString()}`
      }

      const bytes = uint8ArrayFromString(str)

      // create record
      const record = await create(key, bytes, sequenceNumber, options.lifetime ?? DEFAULT_LIFETIME_MS)
      const marshaledRecord = marshal(record)

      await this.localStore.put(routingKey, marshaledRecord, options)

      if (options.offline !== true) {
        // publish record to routing
        await Promise.all(this.routers.map(async r => { await r.put(routingKey, marshaledRecord, options) }))
      }

      return record
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:publish:error', err))
      throw err
    }
  }

  async resolve (key: PeerId, options: ResolveOptions = {}): Promise<CID> {
    const routingKey = peerIdToRoutingKey(key)
    const record = await this.#findIpnsRecord(routingKey, options)
    const str = uint8ArrayToString(record.value)

    return this.#resolve(str, options)
  }

  async resolveDns (domain: string, options: ResolveDNSOptions = {}): Promise<CID> {
    const dnslink = await resolveDnslink(domain, options)

    return this.#resolve(dnslink, options)
  }

  republish (options: RepublishOptions = {}): void {
    if (this.timeout != null) {
      throw new Error('Republish is already running')
    }

    options.signal?.addEventListener('abort', () => {
      clearTimeout(this.timeout)
    })

    async function republish (): Promise<void> {
      const startTime = Date.now()

      options.onProgress?.(new CustomProgressEvent('ipns:republish:start'))

      const finishType = Date.now()
      const timeTaken = finishType - startTime
      let nextInterval = DEFAULT_REPUBLISH_INTERVAL_MS - timeTaken

      if (nextInterval < 0) {
        nextInterval = options.interval ?? DEFAULT_REPUBLISH_INTERVAL_MS
      }

      setTimeout(() => {
        republish().catch(err => {
          log.error('error republishing', err)
        })
      }, nextInterval)
    }

    this.timeout = setTimeout(() => {
      republish().catch(err => {
        log.error('error republishing', err)
      })
    }, options.interval ?? DEFAULT_REPUBLISH_INTERVAL_MS)
  }

  async #resolve (ipfsPath: string, options: ResolveOptions = {}): Promise<CID> {
    const parts = ipfsPath.split('/')

    if (parts.length === 3) {
      const scheme = parts[1]

      if (scheme === 'ipns') {
        return this.resolve(peerIdFromString(parts[2]), options)
      } else if (scheme === 'ipfs') {
        return CID.parse(parts[2])
      }
    }

    log.error('invalid ipfs path %s', ipfsPath)
    throw new Error('Invalid value')
  }

  async #findIpnsRecord (routingKey: Uint8Array, options: ResolveOptions = {}): Promise<IPNSEntry> {
    let routers = [
      this.localStore,
      ...this.routers
    ]

    if (options.offline === true) {
      routers = [
        this.localStore
      ]
    }

    const records: Uint8Array[] = []

    await Promise.all(
      routers.map(async (router) => {
        try {
          const record = await router.get(routingKey, options)
          await ipnsValidator(routingKey, record)

          records.push(record)
        } catch (err) {
          log.error('error finding IPNS record', err)
        }
      })
    )

    if (records.length === 0) {
      throw new CodeError('Could not find record for routing key', 'ERR_NOT_FOUND')
    }

    const record = records[ipnsSelector(routingKey, records)]

    await this.localStore.put(routingKey, record, options)

    return unmarshal(record)
  }
}

export function ipns (components: IPNSComponents, routers: IPNSRouting[] = []): IPNS {
  return new DefaultIPNS(components, routers)
}

export { ipnsValidator }
export { ipnsSelector } from 'ipns/selector'
