/**
 * @packageDocumentation
 *
 * [DNSLink](https://dnslink.dev/) operations using a Helia node.
 *
 * @example Using custom DNS over HTTPS resolvers
 *
 * To use custom resolvers, configure Helia's `dns` option:
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { dnsLink } from '@helia/dnslink'
 * import { dns } from '@multiformats/dns'
 * import { dnsOverHttps } from '@multiformats/dns/resolvers'
 * import type { DefaultLibp2pServices } from 'helia'
 * import type { Libp2p } from '@libp2p/interface'
 *
 * const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
 *   dns: dns({
 *     resolvers: {
 *       '.': dnsOverHttps('https://private-dns-server.me/dns-query')
 *     }
 *   })
 * })
 * const name = dnsLink(node)
 *
 * const result = name.resolve('some-domain-with-dnslink-entry.com')
 * ```
 *
 * @example Resolving a domain with a dnslink entry
 *
 * Calling `resolve` with the `@helia/dnslink` instance:
 *
 * ```TypeScript
 * // resolve a CID from a TXT record in a DNS zone file, using the default
 * // resolver for the current platform eg:
 * // > dig _dnslink.ipfs.tech TXT
 * // ;; ANSWER SECTION:
 * // _dnslink.ipfs.tech. 60 IN CNAME _dnslink.ipfs-tech.on.fleek.co.
 * // _dnslink.ipfs-tech.on.fleek.co. 120 IN TXT "dnslink=/ipfs/bafybe..."
 *
 * import { createHelia } from 'helia'
 * import { dnsLink } from '@helia/dnslink'
 *
 * const node = await createHelia()
 * const name = dnsLink(node)
 *
 * const [{ answer }] = await name.resolve('blog.ipfs.tech')
 *
 * console.info(answer)
 * // { data: '/ipfs/bafybe...' }
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
 * import { createHelia } from 'helia'
 * import { dnsLink } from '@helia/dnslink'
 * import { dns } from '@multiformats/dns'
 * import { dnsOverHttps } from '@multiformats/dns/resolvers'
 * import type { DefaultLibp2pServices } from 'helia'
 * import type { Libp2p } from '@libp2p/interface'
 *
 * const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
 *   dns: dns({
 *     resolvers: {
 *       '.': dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *     }
 *   })
 * })
 * const name = dnsLink(node)
 *
 * const result = await name.resolve('blog.ipfs.tech')
 * ```
 *
 * @example Using DNS-JSON-Over-HTTPS
 *
 * DNS-JSON-Over-HTTPS resolvers use the RFC 8427 `application/dns-json` and can
 * result in a smaller browser bundle due to the response being plain JSON.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { dnsLink } from '@helia/dnslink'
 * import { dns } from '@multiformats/dns'
 * import { dnsJsonOverHttps } from '@multiformats/dns/resolvers'
 * import type { DefaultLibp2pServices } from 'helia'
 * import type { Libp2p } from '@libp2p/interface'
 *
 * const node = await createHelia<Libp2p<DefaultLibp2pServices>>({
 *   dns: dns({
 *     resolvers: {
 *       '.': dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query')
 *     }
 *   })
 * })
 * const name = dnsLink(node)
 *
 * const result = await name.resolve('blog.ipfs.tech')
 * ```
 */

import { DNSLink as DNSLinkClass } from './dnslink.js'
import type { AbortOptions, ComponentLogger, PeerId } from '@libp2p/interface'
import type { Answer, DNS, ResolveDnsProgressEvents } from '@multiformats/dns'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface ResolveDNSLinkOptions extends AbortOptions, ProgressOptions<ResolveDnsProgressEvents> {
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

export interface DNSLinkIPFSResult {
  /**
   * The resolved record
   */
  answer: Answer

  /**
   * The IPFS namespace
   */
  namespace: 'ipfs'

  /**
   * The resolved value
   */
  cid: CID

  /**
   * If the resolved value is an IPFS path, it will be present here
   */
  path: string
}

export interface DNSLinkIPNSResult {
  /**
   * The resolved record
   */
  answer: Answer

  /**
   * The IPFS namespace
   */
  namespace: 'ipns'

  /**
   * The resolved value
   */
  peerId: PeerId

  /**
   * If the resolved value is an IPFS path, it will be present here
   */
  path: string
}

export interface DNSLinkOtherResult {
  /**
   * The resolved record
   */
  answer: Answer

  /**
   * The IPFS namespace
   */
  namespace: string
}

export type DNSLinkResult = DNSLinkIPFSResult | DNSLinkIPNSResult | DNSLinkOtherResult

export interface DNSLinkNamespace {
  /**
   * Return a result parsed from a DNSLink value
   */
  parse(value: string, answer: Answer): DNSLinkResult
}

export interface DNSLink {
  /**
   * Resolve a CID from a dns-link style IPNS record
   *
   * @example
   *
   * ```TypeScript
   * import { createHelia } from 'helia'
   * import { dnsLink } from '@helia/dnslink'
   *
   * const helia = await createHelia()
   * const name = dnsLink(helia)
   *
   * const result = await name.resolve('ipfs.io', {
   *   signal: AbortSignal.timeout(5_000)
   * })
   *
   * console.info(result) // { answer: ..., value: ... }
   * ```
   */
  resolve(domain: string, options?: ResolveDNSLinkOptions): Promise<DNSLinkResult[]>
}

export interface DNSLinkComponents {
  dns: DNS
  logger: ComponentLogger
}

export interface DNSLinkOptions {
  /**
   * By default `/ipfs/...`, `/ipns/...` and `/dnslink/...` record values are
   * supported - to support other prefixes pass other value parsers here
   */
  namespaces?: Record<string, DNSLinkNamespace>
}

export function dnsLink (components: DNSLinkComponents, options: DNSLinkOptions = {}): DNSLink {
  return new DNSLinkClass(components, options)
}
