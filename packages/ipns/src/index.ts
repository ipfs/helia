/**
 * @packageDocumentation
 *
 * [IPNS](https://docs.ipfs.tech/concepts/ipns/) operations using a Helia node
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
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * const { publicKey } = await name.publish('key-1', cid)
 *
 * // resolve the name
 * const result = await name.resolve(publicKey)
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
 * import { createHelia } from 'helia'export interface IPNSRecordMetadata {
  keyName: string
  lifetime: number
  upkeep: Upkeep
}
 * import { ipns } from '@helia/ipns'
 * import { unixfs } from '@helia/unixfs'
 * import { generateKeyPair } from '@libp2p/crypto/keys'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * const { publicKey } = await name.publish('key-1', cid)
 *
 * // publish the recursive name
 * const { publicKey: recursivePublicKey } = await name.publish('key-2', publicKey)
 *
 * // resolve the name recursively - it resolves until a CID is found
 * const result = await name.resolve(recursivePublicKey)
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
 * import { generateKeyPair } from '@libp2p/crypto/keys'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // store the file in a directory
 * const dirCid = await fs.addDirectory()
 * const finalDirCid = await fs.cp(fileCid, dirCid, '/foo.txt')
 *
 * // publish the name
 * const { publicKey } = await name.publish('key-1', `/ipfs/${finalDirCid}/foo.txt`)
 *
 * // resolve the name
 * const result = await name.resolve(publicKey)
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
 * import { floodsub } from '@libp2p/floodsub'
 * import { generateKeyPair } from '@libp2p/crypto/keys'
 * import type { PubSub } from '@helia/ipns/routing'
 * import type { Libp2p } from '@libp2p/interface'
 * import type { DefaultLibp2pServices } from 'helia'
 *
 * const libp2pOptions = libp2pDefaults()
 * libp2pOptions.services.pubsub = floodsub()
 *
 * const helia = await createHelia<Libp2p<DefaultLibp2pServices & { pubsub: PubSub }>>({
 *   libp2p: libp2pOptions
 * })
 * const name = ipns(helia, {
 *  routers: [
 *    pubsub(helia)
 *  ]
 * })
 *
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * const { publicKey } = await name.publish('key-1', cid)
 *
 * // resolve the name
 * const result = await name.resolve(publicKey)
 * ```
 *
 * @example Republishing an existing IPNS record
 *
 * It is sometimes useful to be able to republish an existing IPNS record
 * without needing the private key. This allows you to extend the availability
 * of a record that was created elsewhere.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns, ipnsValidator } from '@helia/ipns'
 * import { delegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
 * import { CID } from 'multiformats/cid'
 * import { multihashToIPNSRoutingKey, marshalIPNSRecord } from 'ipns'
 * import { defaultLogger } from '@libp2p/logger'
 *
 * const helia = await createHelia()
 * const name = ipns(helia)
 *
 * const ipnsName = 'k51qzi5uqu5dktsyfv7xz8h631pri4ct7osmb43nibxiojpttxzoft6hdyyzg4'
 * const parsedCid: CID<unknown, 114, 0 | 18, 1> = CID.parse(ipnsName)
 * const delegatedClient = delegatedRoutingV1HttpApiClient({
 *   url: 'https://delegated-ipfs.dev'
 * })({
 *   logger: defaultLogger()
 * })
 * const record = await delegatedClient.getIPNS(parsedCid)
 *
 * // publish the latest existing record to routing
 * // use `options.force` if the record is already published
 * const { record: latestRecord } = await name.republish(parsedCid, { record })
 *
 * // stop republishing a key
 * await name.unpublish(parsedCid)
 * ```
 */

import { ipnsValidator } from 'ipns/validator'
import { CID } from 'multiformats/cid'
import { IPNSResolver as IPNSResolverClass } from './ipns/resolver.js'
import { IPNS as IPNSClass } from './ipns.js'
import { localStore } from './local-store.ts'
import { helia } from './routing/index.js'
import { localStoreRouting } from './routing/local-store.ts'
import type { IPNSResolverComponents } from './ipns/resolver.js'
import type { IPNSRouting, IPNSRoutingProgressEvents } from './routing/index.js'
import type { Routing, HeliaEvents } from '@helia/interface'
import type { AbortOptions, ComponentLogger, Libp2p, PeerId, PublicKey, TypedEventEmitter } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { Datastore } from 'interface-datastore'
import type { IPNSRecord } from 'ipns'
import type { MultihashDigest } from 'multiformats/hashes/interface'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type PublishProgressEvents =
  ProgressEvent<'ipns:publish:start'> |
  ProgressEvent<'ipns:publish:success', IPNSRecord> |
  ProgressEvent<'ipns:publish:error', Error>

export type ResolveProgressEvents =
  ProgressEvent<'ipns:resolve:start', unknown> |
  ProgressEvent<'ipns:resolve:success', IPNSRecord> |
  ProgressEvent<'ipns:resolve:error', Error>

export type RepublishProgressEvents =
  ProgressEvent<'ipns:republish:start'> |
  ProgressEvent<'ipns:republish:success', IPNSRecord> |
  ProgressEvent<'ipns:republish:error', Error>

export type DatastoreProgressEvents =
  ProgressEvent<'ipns:routing:datastore:put'> |
  ProgressEvent<'ipns:routing:datastore:get'> |
  ProgressEvent<'ipns:routing:datastore:list'> |
  ProgressEvent<'ipns:routing:datastore:error', Error>

export interface PublishOptions extends AbortOptions, ProgressOptions<PublishProgressEvents | IPNSRoutingProgressEvents> {
  /**
   * Time duration of the signature validity in ms (default: 48hrs)
   */
  lifetime?: number

  /**
   * Initially only publish to a local datastore (default: false)
   */
  offline?: boolean

  /**
   * By default a IPNS V1 and a V2 signature is added to every record. Pass
   * false here to only add a V2 signature. (default: true)
   */
  v1Compatible?: boolean

  /**
   * The TTL of the record in ms (default: 5 minutes)
   */
  ttl?: number

  /**
   * Automated record upkeep policy. (default: "republish")
   *
   * - `republish`: create a new record with a refreshed TTL
   * - `refresh`: publish the existing record until it expires
   * - `none`: disable automated publishing
   */
  upkeep?: 'republish' | 'refresh' | 'none'
}

export interface ResolveOptions extends AbortOptions, ProgressOptions<ResolveProgressEvents | IPNSRoutingProgressEvents> {
  /**
   * Do not query the network for the IPNS record
   *
   * @default false
   */
  offline?: boolean

  /**
   * Do not use cached IPNS Record entries
   *
   * @default false
   */
  nocache?: boolean
}

export interface RepublishOptions extends AbortOptions, ProgressOptions<RepublishProgressEvents | IPNSRoutingProgressEvents> {
  /**
   * A candidate IPNS record to use if no newer records are found
   */
  record?: IPNSRecord

  /**
   * Initially only republish to a local datastore (default: false)
   */
  offline?: boolean

  /**
   * Skip resolution of latest record before republishing (default: false)
   *
   * It's important to resolve the latest record before republishing to routers
   * Resolution should only be skipped if confident the latest record is already known
   */
  skipResolution?: boolean

  /**
   * Force the record to be republished even if already resolvable
   *
   * @default false
   */
  force?: boolean

  /**
   * Automated record upkeep policy. (default: "refresh")
   *
   * - `refresh`: republish the existing record until it expires
   * - `none`: disable automated publishing
   */
  upkeep?: 'refresh' | 'none'
}

export interface ResolveResult {
  /**
   * The CID that was resolved
   */
  cid: CID

  /**
   * Any path component that was part of the resolved record
   */
  path?: string
}

export interface IPNSResolveResult extends ResolveResult {
  /**
   * The resolved record
   */
  record: IPNSRecord
}

export interface IPNSPublishResult {
  /**
   * The published record
   */
  record: IPNSRecord

  /**
   * The public key that was used to publish the record
   */
  publicKey: PublicKey
}

export interface IPNSRepublishResult {
  /**
   * The published record
   */
  record: IPNSRecord
}

export interface IPNSResolver {
  /**
   * Accepts a libp2p public key, a CID with the libp2p-key codec and either the
   * identity hash (for Ed25519 and secp256k1 public keys) or a SHA256 hash (for
   * RSA public keys), or the multihash of a libp2p-key encoded CID, or a
   * Ed25519, secp256k1 or RSA PeerId and recursively resolves the IPNS record
   * corresponding to that key until a value is found.
   */
  resolve(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options?: ResolveOptions): Promise<IPNSResolveResult>
}

export interface IPNS {
  /**
   * Configured routing subsystems used to publish/resolve IPNS names
   */
  routers: IPNSRouting[]

  /**
   * Creates and publishes an IPNS record that will resolve the passed value
   * signed by a key stored in the libp2p keychain under the passed key name.
   *
   * It is possible to create a recursive IPNS record by passing:
   *
   * - A PeerId,
   * - A PublicKey
   * - A CID with the libp2p-key codec and Identity or SHA256 hash algorithms
   * - A Multihash with the Identity or SHA256 hash algorithms
   * - A string IPNS key (e.g. `/ipns/Qmfoo`)
   *
   * @example
   *
   * ```TypeScript
   * import { createHelia } from 'helia'
   * import { ipns } from '@helia/ipns'
   *
   * const helia = await createHelia()
   * const name = ipns(helia)
   *
   * const result = await name.publish('my-key-name', cid, {
   *   signal: AbortSignal.timeout(5_000)
   * })
   *
   * console.info(result) // { answer: ... }
   * ```
   */
  publish(keyName: string, value: CID | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId | string, options?: PublishOptions): Promise<IPNSPublishResult>

  /**
   * Accepts a libp2p public key, a CID with the libp2p-key codec and either the
   * identity hash (for Ed25519 and secp256k1 public keys) or a SHA256 hash (for
   * RSA public keys), or the multihash of a libp2p-key encoded CID, or a
   * Ed25519, secp256k1 or RSA PeerId and recursively resolves the IPNS record
   * corresponding to that key until a value is found.
   */
  resolve(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options?: ResolveOptions): Promise<IPNSResolveResult>

  /**
   * Stop republishing of an IPNS record
   *
   * This will delete the last signed IPNS record from the datastore, but the
   * key will remain in the keychain.
   *
   * Note that the record may still be resolved by other peers until it expires
   * or is no longer valid.
   */
  unpublish(keyName: string | CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options?: AbortOptions): Promise<void>

  /**
   * Republish the latest known existing record to all routers
   *
   * This will automatically be done regularly unless `options.repeat` is false
   *
   * Use `unpublish` to stop republishing a key
   */
  republish(key: CID<unknown, 0x72, 0x00 | 0x12, 1> | PublicKey | MultihashDigest<0x00 | 0x12> | PeerId, options?: RepublishOptions): Promise<IPNSRepublishResult>
}

export type { IPNSRouting } from './routing/index.js'

export type { IPNSRecord } from 'ipns'

export interface IPNSComponents {
  datastore: Datastore
  routing: Routing
  logger: ComponentLogger
  libp2p: Libp2p<{ keychain: Keychain }>
  events: TypedEventEmitter<HeliaEvents> // Helia event bus
}

export interface IPNSOptions {
  /**
   * Different routing systems for IPNS publishing/resolving
   */
  routers?: IPNSRouting[]

  /**
   * How often to check if published records have expired and need republishing
   * in ms
   *
   * @default 3_600_000
   */
  republishInterval?: number

  /**
   * How many IPNS records to republish at once
   *
   * @default 5
   */
  republishConcurrency?: number
}

export interface IPNSResolverOptions {
  /**
   * Different routing systems for IPNS publishing/resolving
   */
  routers?: IPNSRouting[]
}

export function ipns (components: IPNSComponents, options: IPNSOptions = {}): IPNS {
  return new IPNSClass(components, options)
}

export function ipnsResolver (components: IPNSResolverComponents, options: IPNSResolverOptions = {}): IPNSResolver {
  const store = localStore(components.datastore, components.logger.forComponent('helia:ipns:local-store'))
  const routers = [
    localStoreRouting(store),
    helia(components.routing),
    ...(options.routers ?? [])
  ]

  return new IPNSResolverClass(components, {
    routers,
    localStore: store
  })
}

export { ipnsValidator, type IPNSRoutingProgressEvents }
export { ipnsSelector } from 'ipns/selector'
