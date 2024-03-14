/**
 * @packageDocumentation
 *
 * IPNS operations using a Helia node
 *
 * @example Getting started
 *
 * With {@link IPNSRouting} routers:
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * // create a public key to publish as an IPNS name
 * const keyInfo = await helia.libp2p.services.keychain.createKey('my-key')
 * const peerId = await helia.libp2p.services.keychain.exportPeerId(keyInfo.name)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * await name.publish(peerId, cid)
 *
 * // resolve the name
 * const result = name.resolve(peerId)
 *
 * console.info(result.cid, result.path)
 * ```
 *
 * @example Publishing a recursive record
 *
 * A recursive record is a one that points to another record rather than to a
 * value.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * // create a public key to publish as an IPNS name
 * const keyInfo = await helia.libp2p.services.keychain.createKey('my-key')
 * const peerId = await helia.libp2p.services.keychain.exportPeerId(keyInfo.name)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * await name.publish(peerId, cid)
 *
 * // create another public key to re-publish the original record
 * const recursiveKeyInfo = await helia.libp2p.services.keychain.createKey('my-recursive-key')
 * const recursivePeerId = await helia.libp2p.services.keychain.exportPeerId(recursiveKeyInfo.name)
 *
 * // publish the recursive name
 * await name.publish(recursivePeerId, peerId)
 *
 * // resolve the name recursively - it resolves until a CID is found
 * const result = name.resolve(recursivePeerId)
 * console.info(result.cid.toString() === cid.toString()) // true
 * ```
 *
 * @example Publishing a record with a path
 *
 * It is possible to publish CIDs with an associated path.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * // create a public key to publish as an IPNS name
 * const keyInfo = await helia.libp2p.services.keychain.createKey('my-key')
 * const peerId = await helia.libp2p.services.keychain.exportPeerId(keyInfo.name)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const fileCid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // store the file in a directory
 * const dirCid = await fs.mkdir()
 * const finalDirCid = await fs.cp(fileCid, dirCid, '/foo.txt')
 *
 * // publish the name
 * await name.publish(peerId, `/ipfs/${finalDirCid}/foo.txt)
 *
 * // resolve the name
 * const result = name.resolve(peerId)
 *
 * console.info(result.cid, result.path) // QmFoo.. 'foo.txt'
 * ```
 *
 * @example Using custom PubSub router
 *
 * Additional IPNS routers can be configured - these enable alternative means to
 * publish and resolve IPNS names.
 *
 * One example is the PubSub router - this requires an instance of Helia with
 * libp2p PubSub configured.
 *
 * It works by subscribing to a pubsub topic for each IPNS name that we try to
 * resolve. Updated IPNS records are shared on these topics so an update must
 * occur before the name is resolvable.
 *
 * This router is only suitable for networks where IPNS updates are frequent
 * and multiple peers are listening on the topic(s), otherwise update messages
 * may fail to be published with "Insufficient peers" errors.
 *
 * ```TypeScript
 * import { createHelia, libp2pDefaults } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { pubsub } from '@helia/ipns/routing'
 * import { unixfs } from '@helia/unixfs'
 * import { gossipsub } from '@chainsafe/libp2p-gossipsub'
 *
 * const libp2pOptions = libp2pDefaults()
 * libp2pOptions.services.pubsub = gossipsub()
 *
 * const helia = await createHelia({
 *   libp2p: libp2pOptions
 * })
 * const name = ipns(helia, {
 *  routers: [
 *    pubsub(helia)
 *  ]
 * })
 *
 * // create a public key to publish as an IPNS name
 * const keyInfo = await helia.libp2p.services.keychain.createKey('my-key')
 * const peerId = await helia.libp2p.services.keychain.exportPeerId(keyInfo.name)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * await name.publish(peerId, cid)
 *
 * // resolve the name
 * const { cid, path } = name.resolve(peerId)
 * ```
 *
 * @example Using custom DNS over HTTPS resolvers
 *
 * With default {@link DNSResolver} resolvers:
 *
 * ```TypeScript
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
 * const { cid, path } = name.resolveDns('some-domain-with-dnslink-entry.com')
 * ```
 *
 * @example Resolving a domain with a dnslink entry
 *
 * Calling `resolveDns` with the `@helia/ipns` instance:
 *
 * ```TypeScript
 * // resolve a CID from a TXT record in a DNS zone file, using the default
 * // resolver for the current platform eg:
 * // > dig _dnslink.ipfs.io TXT
 * // ;; ANSWER SECTION:
 * // _dnslink.ipfs.io.          60     IN      TXT     "dnslink=/ipns/website.ipfs.io"
 * // > dig _dnslink.website.ipfs.io TXT
 * // ;; ANSWER SECTION:
 * // _dnslink.website.ipfs.io.  60     IN      TXT     "dnslink=/ipfs/QmWebsite"
 *
 * const { cid, path } = name.resolveDns('ipfs.io')
 *
 * console.info(cid)
 * // QmWebsite
 * ```
 *
 * @example Using DNS-Over-HTTPS
 *
 * This example uses the Mozilla provided RFC 1035 DNS over HTTPS service. This
 * uses binary DNS records so requires extra dependencies to process the
 * response which can increase browser bundle sizes.
 *
 * If this is a concern, use the DNS-JSON-Over-HTTPS resolver instead.
 *
 * ```TypeScript
 * // use DNS-Over-HTTPS
 * import { dnsOverHttps } from '@helia/ipns/dns-resolvers'
 *
 * const { cid, path } = name.resolveDns('ipfs.io', {
 *   resolvers: [
 *     dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *   ]
 * })
 * ```
 *
 * @example Using DNS-JSON-Over-HTTPS
 *
 * DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
 * result in a smaller browser bundle due to the response being plain JSON.
 *
 * ```TypeScript
 * // use DNS-JSON-Over-HTTPS
 * import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
 *
 * const { cid, path } = name.resolveDns('ipfs.io', {
 *   resolvers: [
 *     dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *   ]
 * })
 * ```
 */

import { CodeError } from '@libp2p/interface'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { create, marshal, peerIdToRoutingKey, unmarshal } from 'ipns'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { CID } from 'multiformats/cid'
import { CustomProgressEvent } from 'progress-events'
import { resolveDNSLink } from './dnslink.js'
import { helia } from './routing/helia.js'
import { localStore, type LocalStore } from './routing/local-store.js'
import type { IPNSRouting, IPNSRoutingEvents } from './routing/index.js'
import type { Routing } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Logger, PeerId } from '@libp2p/interface'
import type { Answer, DNS, ResolveDnsProgressEvents } from '@multiformats/dns'
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

export type ResolveDNSLinkProgressEvents =
  ResolveProgressEvents |
  IPNSRoutingEvents |
  ResolveDnsProgressEvents

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

export interface ResolveDNSLinkOptions extends AbortOptions, ProgressOptions<ResolveDNSLinkProgressEvents> {
  /**
   * Do not query the network for the IPNS record
   *
   * @default false
   */
  offline?: boolean

  /**
   * Do not use cached DNS entries
   *
   * @default false
   */
  nocache?: boolean

  /**
   * When resolving DNSLink records that resolve to other DNSLink records, limit
   * how many times we will recursively resolve them.
   *
   * @default 32
   */
  maxRecursiveDepth?: number
}

export interface RepublishOptions extends AbortOptions, ProgressOptions<RepublishProgressEvents | IPNSRoutingEvents> {
  /**
   * The republish interval in ms (default: 23hrs)
   */
  interval?: number
}

export interface ResolveResult {
  /**
   * The CID that was resolved
   */
  cid: CID

  /**
   * Any path component that was part of the resolved record
   *
   * @default ""
   */
  path: string
}

export interface IPNSResolveResult extends ResolveResult {
  /**
   * The resolved record
   */
  record: IPNSRecord
}

export interface DNSLinkResolveResult extends ResolveResult {
  /**
   * The resolved record
   */
  answer: Answer
}

export interface IPNS {
  /**
   * Creates an IPNS record signed by the passed PeerId that will resolve to the passed value
   *
   * If the value is a PeerId, a recursive IPNS record will be created.
   */
  publish(key: PeerId, value: CID | PeerId | string, options?: PublishOptions): Promise<IPNSRecord>

  /**
   * Accepts a public key formatted as a libp2p PeerID and resolves the IPNS record
   * corresponding to that public key until a value is found
   */
  resolve(key: PeerId, options?: ResolveOptions): Promise<IPNSResolveResult>

  /**
   * Resolve a CID from a dns-link style IPNS record
   */
  resolveDNSLink(domain: string, options?: ResolveDNSLinkOptions): Promise<DNSLinkResolveResult>

  /**
   * Periodically republish all IPNS records found in the datastore
   */
  republish(options?: RepublishOptions): void
}

export type { IPNSRouting } from './routing/index.js'

export interface IPNSComponents {
  datastore: Datastore
  routing: Routing
  dns: DNS
  logger: ComponentLogger
}

class DefaultIPNS implements IPNS {
  private readonly routers: IPNSRouting[]
  private readonly localStore: LocalStore
  private timeout?: ReturnType<typeof setTimeout>
  private readonly dns: DNS
  private readonly log: Logger

  constructor (components: IPNSComponents, routers: IPNSRouting[] = []) {
    this.routers = [
      helia(components.routing),
      ...routers
    ]
    this.localStore = localStore(components.datastore)
    this.dns = components.dns
    this.log = components.logger.forComponent('helia:ipns')
  }

  async publish (key: PeerId, value: CID | PeerId | string, options: PublishOptions = {}): Promise<IPNSRecord> {
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

  async resolve (key: PeerId, options: ResolveOptions = {}): Promise<IPNSResolveResult> {
    const routingKey = peerIdToRoutingKey(key)
    const record = await this.#findIpnsRecord(routingKey, options)

    return {
      ...(await this.#resolve(record.value, options)),
      record
    }
  }

  async resolveDNSLink (domain: string, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResolveResult> {
    const dnslink = await resolveDNSLink(domain, this.dns, this.log, options)

    return {
      ...(await this.#resolve(dnslink.value, options)),
      answer: dnslink.answer
    }
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

  async #resolve (ipfsPath: string, options: ResolveOptions = {}): Promise<{ cid: CID, path: string }> {
    const parts = ipfsPath.split('/')
    try {
      const scheme = parts[1]

      if (scheme === 'ipns') {
        const { cid } = await this.resolve(peerIdFromString(parts[2]), options)
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
      log.error('error parsing ipfs path', err)
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
    let foundInvalid = 0

    await Promise.all(
      routers.map(async (router) => {
        let record: Uint8Array

        try {
          record = await router.get(routingKey, {
            ...options,
            validate: false
          })
        } catch (err: any) {
          if (router === this.localStore && err.code === 'ERR_NOT_FOUND') {
            log('did not have record locally')
          } else {
            log.error('error finding IPNS record', err)
          }

          return
        }

        try {
          await ipnsValidator(routingKey, record)

          records.push(record)
        } catch (err) {
          // we found a record, but the validator rejected it
          foundInvalid++
          log.error('error finding IPNS record', err)
        }
      })
    )

    if (records.length === 0) {
      if (foundInvalid > 0) {
        throw new CodeError(`${foundInvalid > 1 ? `${foundInvalid} records` : 'Record'} found for routing key ${foundInvalid > 1 ? 'were' : 'was'} invalid`, 'ERR_RECORDS_FAILED_VALIDATION')
      }

      throw new CodeError('Could not find record for routing key', 'ERR_NOT_FOUND')
    }

    const record = records[ipnsSelector(routingKey, records)]

    await this.localStore.put(routingKey, record, options)

    return unmarshal(record)
  }
}

export interface IPNSOptions {
  routers?: IPNSRouting[]
}

export function ipns (components: IPNSComponents, { routers = [] }: IPNSOptions = {}): IPNS {
  return new DefaultIPNS(components, routers)
}

export { ipnsValidator, type IPNSRoutingEvents }
export { ipnsSelector } from 'ipns/selector'
