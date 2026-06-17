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
 * for await (const result of name.resolve(publicKey)) {
 *   console.info(result.record.value) // /ipfs/QmFoo
 * }
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
 * for await (const result of name.resolve(recursivePublicKey)) {
 *   console.info(result.record.value) // /ipfs/QmFoo../foo.txt
 * }
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
 * for await (const result of name.resolve(publicKey)) {
 *   console.info(result.record.value) // /ipfs/QmFoo../foo.txt
 * }
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
 * import { ipns } from '@helia/ipns'
 * import { pubsub } from '@helia/ipns/routing'
 * import { withLibp2p, libp2pDefaults } from '@helia/libp2p'
 * import { unixfs } from '@helia/unixfs'
 * import { generateKeyPair } from '@libp2p/crypto/keys'
 * import { floodsub } from '@libp2p/floodsub'
 * import { createHelia } from 'helia'
 * import type { Helia } from '@helia/interface'
 * import type { PubSub } from '@helia/ipns/routing'
 * import type { DefaultLibp2pServices } from '@helia/libp2p'
 * import type { FloodSub } from '@libp2p/floodsub'
 * import type { Libp2p } from '@libp2p/interface'
 *
 * const libp2pOptions = libp2pDefaults() as any
 * libp2pOptions.services.pubsub = floodsub()
 *
 * const helia = await withLibp2p<Helia, { pubsub: FloodSub }>(createHelia(), libp2pOptions).start()
 *
 * const name = ipns(helia, {
 *  routers: [
 *    pubsub(helia)
 *  ]
 * })
 *
 * // store some data to publish
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
 *
 * // publish the name
 * const { publicKey } = await name.publish('key-1', cid)
 *
 * // resolve the name
 * for await (const result of name.resolve(publicKey)) {
 *   console.info(result.record.value)
 * }
 * ```
 *
 * @example Republishing an existing IPNS record
 *
 * It is sometimes useful to be able to republish an existing IPNS record
 * without needing the private key. This allows you to extend the availability
 * of a record that was created elsewhere.
 *
 * There should be only one republisher per IPNS key. Multiple machines
 * republishing the same key will conflict on sequence numbers and flood the
 * DHT with redundant writes.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { delegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
 * import { CID } from 'multiformats/cid'
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
 * // republish to routing; throws RecordAlreadyPublishedError if a newer record
 * // is already resolvable — pass `force: true` only if you know no one else is
 * // republishing this key
 * const { record: latestRecord } = await name.republish(parsedCid, { record })
 *
 * // stop republishing a key
 * await name.unpublish(parsedCid)
 * ```
 */

import { CID } from 'multiformats/cid'
import { IPNSResolver as IPNSResolverClass } from './ipns/resolver.ts'
import { IPNS as IPNSClass } from './ipns.ts'
import { localStore } from './local-store.ts'
import { helia } from './routing/index.ts'
import { localStoreRouting } from './routing/local-store.ts'
import type { IPNSResolverComponents } from './ipns/resolver.ts'
import type { IPNSRecord } from './records.ts'
import type { IPNSRouting, IPNSRoutingProgressEvents } from './routing/index.ts'
import type { Routing, HeliaEvents, Keychain, PublicKey } from '@helia/interface'
import type { ComponentLogger, TypedEventEmitter } from '@libp2p/interface'
import type { AbortOptions } from 'abort-error'
import type { Datastore } from 'interface-datastore'
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
   * Time duration of the signature validity in ms
   *
   * @default 172_800_000
   */
  lifetime?: number

  /**
   * Only publish to the local datastore, skipping the routers
   *
   * @default false
   */
  offline?: boolean

  /**
   * By default a IPNS V1 and a V2 signature is added to every record. Pass
   * false here to only add a V2 signature.
   *
   * @default true
   */
  v1Compatible?: boolean

  /**
   * The TTL of the record in ms
   *
   * @default 300_000
   */
  ttl?: number

  /**
   * Automated record upkeep policy.
   *
   * - `republish`: create a new record with a refreshed TTL
   * - `refresh`: publish the existing record until it expires
   * - `none`: disable automated publishing
   *
   * @default 'republish'
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
   * Only republish to the local datastore, skipping the routers
   *
   * @default false
   */
  offline?: boolean

  /**
   * Skip resolution of latest record before republishing.
   *
   * It's important to resolve the latest record before republishing to routers
   *
   * Resolution should only be skipped when confident the latest record is
   * already known.
   *
   * @default false
   */
  skipResolution?: boolean

  /**
   * Force the record to be republished even when already resolvable.
   *
   * It's important for republishing to be handled by a single machine.
   *
   * Republishing should only be forced when confident the record is not being
   * republished by other clients
   *
   * @default false
   */
  force?: boolean

  /**
   * Automated record upkeep policy.
   *
   * Defaults to `refresh` since `republish()` cannot sign new records without
   * the private key.
   *
   * - `refresh`: republish the existing record until it expires
   * - `none`: disable automated publishing
   *
   * @default 'refresh'
   */
  upkeep?: 'refresh' | 'none'
}

export interface ResolveResult {
  /**
   * The resolved record
   */
  record: IPNSRecord
}

export interface PublishResult {
  /**
   * The published record
   */
  record: IPNSRecord

  /**
   * The IPNS name that can be used to resolve this record
   */
  name: string

  /**
   * The public key that was used to sign and publish the record
   */
  publicKey: PublicKey
}

export interface RepublishResult {
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
  resolve(key: CID<unknown, 0x72> | MultihashDigest, options?: ResolveOptions): AsyncGenerator<ResolveResult>
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
   * If the key does not exist, a new Ed25519 key will be created. To use a
   * different key types, ensure the key is created and stored in the keychain
   * before invoking this method.
   *
   * It is possible to create a recursive IPNS record by passing:
   *
   * - A CID with the libp2p-key codec
   * - A Multihash
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
  publish(keyName: string, value: CID | PublicKey | MultihashDigest | string, options?: PublishOptions): Promise<PublishResult>

  /**
   * Accepts a multihash of a public key, a libp2p-key CID containing the
   * multihash of a public key, or an IPNS name in it's string representation
   * and recursively resolves IPNS records until a non-recursive record is found
   * (e.g. the value can be parsed as a string that does not start with
   * `/ipns/`).
   */
  resolve(name: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: ResolveOptions): AsyncGenerator<ResolveResult>

  /**
   * Stop republishing of an IPNS record
   *
   * This will delete the last signed IPNS record from the datastore. If a key
   * name is passed, the key will remain in the keychain.
   *
   * Note that the record may still be resolved by other peers until it expires
   * or is otherwise no longer valid.
   */
  unpublish(key: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: AbortOptions): Promise<void>

  /**
   * Republish the latest known existing record to all routers
   *
   * Updates the record's upkeep policy to `options.upkeep`.
   *
   * The background republisher will then keep the record alive accordingly.
   *
   * Use `unpublish` to stop republishing a key.
   *
   * @throws {NotFoundError} when no existing records can be found
   * @throws {RecordAlreadyPublishedError} when a record is already published; pass `force: true` to bypass
   */
  republish(key: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: RepublishOptions): Promise<RepublishResult>
}

export type { IPNSRouting } from './routing/index.ts'
export type { IPNSRecord } from './records.ts'

export interface IPNSComponents {
  datastore: Datastore
  routing: Routing
  logger: ComponentLogger
  keychain: Keychain
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

export type { IPNSRoutingProgressEvents }
