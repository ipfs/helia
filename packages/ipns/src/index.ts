/**
 * @packageDocumentation
 *
 * IPNS operations using a Helia node
 *
 * @example
 *
 * With {@link IPNSRouting} routers:
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { dht, pubsub } from '@helia/ipns/routing'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const name = ipns(helia, {
 *  routers: [
 *    dht(helia),
 *    pubsub(helia)
 *  ]
 * })
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
 * With default {@link DNSResolver} resolvers:
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { unixfs } from '@helia/unixfs'
 * import { dnsOverHttps } from '@helia/ipns/dns-resolvers'
 *
 * const helia = await createHelia()
 * const name = ipns(helia, {
 *  resolvers: [
 *    dnsOverHttps('https://private-dns-server.me/dns-query'),
 *  ]
 * })
 *
 * const cid = name.resolveDns('some-domain-with-dnslink-entry.com')
 * ```
 *
 * @example
 *
 * Calling `resolveDns` with the `@helia/ipns` instance:
 *
 * ```typescript
 * // resolve a CID from a TXT record in a DNS zone file, using the default
 * // resolver for the current platform eg:
 * // > dig _dnslink.ipfs.io TXT
 * // ;; ANSWER SECTION:
 * // _dnslink.ipfs.io.          60     IN      TXT     "dnslink=/ipns/website.ipfs.io"
 * // > dig _dnslink.website.ipfs.io TXT
 * // ;; ANSWER SECTION:
 * // _dnslink.website.ipfs.io.  60     IN      TXT     "dnslink=/ipfs/QmWebsite"
 *
 * const cid = name.resolveDns('ipfs.io')
 *
 * console.info(cid)
 * // QmWebsite
 * ```
 *
 * @example
 *
 * This example uses the Mozilla provided RFC 1035 DNS over HTTPS service. This
 * uses binary DNS records so requires extra dependencies to process the
 * response which can increase browser bundle sizes.
 *
 * If this is a concern, use the DNS-JSON-Over-HTTPS resolver instead.
 *
 * ```typescript
 * // use DNS-Over-HTTPS
 * import { dnsOverHttps } from '@helia/ipns/dns-resolvers'
 *
 * const cid = name.resolveDns('ipfs.io', {
 *   resolvers: [
 *     dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *   ]
 * })
 * ```
 *
 * @example
 *
 * DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
 * result in a smaller browser bundle due to the response being plain JSON.
 *
 * ```typescript
 * // use DNS-JSON-Over-HTTPS
 * import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
 *
 * const cid = name.resolveDns('ipfs.io', {
 *   resolvers: [
 *     dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *   ]
 * })
 * ```
 */

import { CodeError } from '@libp2p/interface/errors'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { create, marshal, peerIdToRoutingKey, unmarshal } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { defaultResolver } from './dns-resolvers/default.js'
import { localStore, type LocalStore } from './routing/local-store.js'
import type { IPNSRouting, IPNSRoutingEvents } from './routing/index.js'
import type { DNSResponse } from './utils/dns.js'
import type { AbortOptions } from '@libp2p/interface'
import type { PeerId } from '@libp2p/interface/peer-id'
import type { Datastore } from 'interface-datastore'
import type { IPNSRecord } from 'ipns'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

const log = logger('helia:ipns')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

const DEFAULT_LIFETIME_MS = 24 * HOUR
const DEFAULT_REPUBLISH_INTERVAL_MS = 23 * HOUR

export type PublishProgressEvents =
  ProgressEvent<'ipns:publish:start'> |
  ProgressEvent<'ipns:publish:success', IPNSRecord> |
  ProgressEvent<'ipns:publish:error', Error>

export type ResolveProgressEvents =
  ProgressEvent<'ipns:resolve:start', unknown> |
  ProgressEvent<'ipns:resolve:success', IPNSRecord> |
  ProgressEvent<'ipns:resolve:error', Error>

export type RepublishProgressEvents =
  ProgressEvent<'ipns:republish:start', unknown> |
  ProgressEvent<'ipns:republish:success', IPNSRecord> |
  ProgressEvent<'ipns:republish:error', { record: IPNSRecord, err: Error }>

export type ResolveDnsLinkProgressEvents =
  ProgressEvent<'dnslink:cache', string> |
  ProgressEvent<'dnslink:query', string> |
  ProgressEvent<'dnslink:answer', DNSResponse>

export interface PublishOptions extends AbortOptions, ProgressOptions<PublishProgressEvents | IPNSRoutingEvents> {
  /**
   * Time duration of the record in ms (default: 24hrs)
   */
  lifetime?: number

  /**
   * Only publish to a local datastore (default: false)
   */
  offline?: boolean

  /**
   * By default a IPNS V1 and a V2 signature is added to every record. Pass
   * false here to only add a V2 signature. (default: true)
   */
  v1Compatible?: boolean
}

export interface ResolveOptions extends AbortOptions, ProgressOptions<ResolveProgressEvents | IPNSRoutingEvents> {
  /**
   * Do not query the network for the IPNS record (default: false)
   */
  offline?: boolean
}

export interface ResolveDnsLinkOptions extends AbortOptions, ProgressOptions<ResolveDnsLinkProgressEvents> {
  /**
   * Do not use cached DNS entries (default: false)
   */
  nocache?: boolean
}

export interface DNSResolver {
  (domain: string, options?: ResolveDnsLinkOptions): Promise<string>
}

export interface ResolveDNSOptions extends AbortOptions, ProgressOptions<ResolveProgressEvents | IPNSRoutingEvents | ResolveDnsLinkProgressEvents> {
  /**
   * Do not query the network for the IPNS record (default: false)
   */
  offline?: boolean

  /**
   * Do not use cached DNS entries (default: false)
   */
  nocache?: boolean

  /**
   * These resolvers will be used to resolve the dnslink entries, if unspecified node will
   * fall back to the `dns` module and browsers fall back to querying google/cloudflare DoH
   *
   * @see https://github.com/ipfs/helia-ipns/pull/55#discussion_r1270096881
   */
  resolvers?: DNSResolver[]
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
  publish(key: PeerId, value: CID | PeerId, options?: PublishOptions): Promise<IPNSRecord>

  /**
   * Accepts a public key formatted as a libp2p PeerID and resolves the IPNS record
   * corresponding to that public key until a value is found
   */
  resolve(key: PeerId, options?: ResolveOptions): Promise<CID>

  /**
   * Resolve a CID from a dns-link style IPNS record
   */
  resolveDns(domain: string, options?: ResolveDNSOptions): Promise<CID>

  /**
   * Periodically republish all IPNS records found in the datastore
   */
  republish(options?: RepublishOptions): void
}

export type { IPNSRouting } from './routing/index.js'

export interface IPNSComponents {
  datastore: Datastore
}

class DefaultIPNS implements IPNS {
  private readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private timeout?: ReturnType<typeof setTimeout>
  private readonly defaultResolvers: DNSResolver[]

  constructor (components: IPNSComponents, routers: IPNSRouting[] = [], resolvers: DNSResolver[] = []) {
    this.routers = routers
    this.localStore = localStore(components.datastore)
    this.defaultResolvers = resolvers.length > 0 ? resolvers : [defaultResolver()]
  }

  async publish (key: PeerId, value: CID | PeerId, options: PublishOptions = {}): Promise<IPNSRecord> {
    try {
      let sequenceNumber = 1n
      const routingKey = peerIdToRoutingKey(key)

      if (await this.localStore.has(routingKey, options)) {
        // if we have published under this key before, increment the sequence number
        const buf = await this.localStore.get(routingKey, options)
        const existingRecord = unmarshal(buf)
        sequenceNumber = existingRecord.sequence + 1n
      }

      // create record
      const record = await create(key, value, sequenceNumber, options.lifetime ?? DEFAULT_LIFETIME_MS, options)
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

    return this.#resolve(record.value, options)
  }

  async resolveDns (domain: string, options: ResolveDNSOptions = {}): Promise<CID> {
    const resolvers = options.resolvers ?? this.defaultResolvers

    const dnslink = await Promise.any(
      resolvers.map(async resolver => resolver(domain, options))
    )

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

  async #findIpnsRecord (routingKey: Uint8Array, options: ResolveOptions = {}): Promise<IPNSRecord> {
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

export interface IPNSOptions {
  routers?: IPNSRouting[]
  resolvers?: DNSResolver[]
}

export function ipns (components: IPNSComponents, { routers = [], resolvers = [] }: IPNSOptions): IPNS {
  return new DefaultIPNS(components, routers, resolvers)
}

export { ipnsValidator }
export { ipnsSelector } from 'ipns/selector'
