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
 * import { ipns, pubSubIPNSRouting } from '@helia/ipns'
 * import { withLibp2p } from '@helia/libp2p'
 * import { unixfs } from '@helia/unixfs'
 * import { fetch } from '@libp2p/fetch'
 * import { floodsub } from '@libp2p/floodsub'
 * import { createHelia } from 'helia'
 *
 * const helia = await withLibp2p(createHelia(), {
 *   services: {
 *     fetch: fetch(),
 *     pubsub: floodsub()
 *   }
 * }).start()
 *
 * const name = ipns(helia, {
 *   routers: [
 *     pubSubIPNSRouting(helia)
 *   ]
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
 * republishing the same key flood the routers with redundant writes.
 *
 * ```TypeScript
 * import { createHelia } from 'helia'
 * import { ipns } from '@helia/ipns'
 * import { delegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
 * import { defaultLogger } from 'birnam'
 * import { CID } from 'multiformats/cid'
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
 * // import the record into the local store (validates and stores it locally,
 * // but does not publish it to the routers)
 * await name.import(parsedCid, record)
 *
 * // start republishing it; throws RecordObsoleteError if the routers
 * // already have a newer record for this key
 * const { record: latestRecord } = await name.republish(parsedCid)
 *
 * // stop republishing a key
 * await name.unpublish(parsedCid)
 * ```
 */

import { CID } from 'multiformats/cid'
import { IPNSResolver as IPNSResolverClass } from './ipns/resolver.ts'
import { IPNS as IPNSClass } from './ipns.ts'
import { localStore } from './local-store.ts'
import { heliaIPNSRouting } from './routing/index.ts'
import { localStoreIPNSRouting } from './routing/local-store.ts'
import type { IPNSResolverComponents } from './ipns/resolver.ts'
import type { IPNSEntry } from './pb/ipns.ts'
import type { IPNSRouting, IPNSRoutingProgressEvents } from './routing/index.ts'
import type { Routing, HeliaEvents, Keychain, PublicKey } from '@helia/interface'
import type { ComponentLogger, TypedEventEmitter } from '@libp2p/interface'
import type { AbortOptions } from 'abort-error'
import type { Datastore } from 'interface-datastore'
import type { MultihashDigest } from 'multiformats/hashes/interface'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export * from './routing/index.ts'
export * from './pb/ipns.ts'
export * from './errors.ts'

export {
  multihashFromIPNSRoutingKey,
  multihashToIPNSRoutingKey
} from './utils.ts'

export {
  createIPNSRecord
} from './records.ts'
export type {
  CreateIPNSRecordOptions
} from './records.ts'

export type PublishProgressEvents =
  ProgressEvent<'ipns:publish:start'> |
  ProgressEvent<'ipns:publish:success', IPNSEntry> |
  ProgressEvent<'ipns:publish:error', Error>

export type ResolveProgressEvents =
  ProgressEvent<'ipns:resolve:start', unknown> |
  ProgressEvent<'ipns:resolve:success', IPNSEntry> |
  ProgressEvent<'ipns:resolve:error', Error>

export type DatastoreProgressEvents =
  ProgressEvent<'ipns:routing:datastore:put'> |
  ProgressEvent<'ipns:routing:datastore:get'> |
  ProgressEvent<'ipns:routing:datastore:list'> |
  ProgressEvent<'ipns:routing:datastore:error', Error>

/**
 * The automated upkeep policy for a stored IPNS record. `republish()` accepts
 * every policy except `reissue`, which needs the private key to re-sign.
 *
 * These strings must match the `Upkeep` enum values in `pb/metadata.proto`.
 */
export type UpkeepPolicy = 'reissue' | 'rebroadcast' | 'none'

export interface PublishOptions extends AbortOptions, ProgressOptions<PublishProgressEvents | IPNSRoutingProgressEvents> {
  /**
   * Time duration of the signature validity in ms - after this many ms have
   * expired the record will be invalidated.
   *
   * @default 172_800_000
   */
  lifetime?: number

  /**
   * Only publish to a local datastore
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
   * The TTL of the record in ms - after this many ms have expired, resolving
   * the record will query the routing for an updated version.
   *
   * Before this many ms have expired any locally stored copy will be treated as
   * the latest version and the routing will not be queried.
   *
   * @default 300_000
   */
  ttl?: number

  /**
   * Automated record upkeep policy.
   *
   * - `reissue`: re-sign the record with a new validity
   * - `rebroadcast`: re-publish the existing record until it expires
   * - `none`: disable automated publishing
   *
   * @default 'reissue'
   */
  upkeep?: UpkeepPolicy

  /**
   * Extensible data that will be added to the IPNS record data and signed to
   * verify it's integrity.
   *
   * Note that this data will be encoded as DAG-CBOR so it must be valid.
   *
   * It is recommended that any custom fields set here are prefixed with `_` to
   * avoid collision with any mandatory fields added to future versions of the
   * IPNS specification.
   *
   * @see https://specs.ipfs.tech/ipns/ipns-record/#extensible-data-dag-cbor
   */
  data?: Record<string, any>
}

/**
 * Extensible data from the record `data` field.
 *
 * The wire format of this data is DAG-CBOR.
 *
 * @see https://specs.ipfs.tech/ipns/ipns-record/#extensible-data-dag-cbor
 */
export interface IPNSRecordData extends Record<string, any> {
  Value: Uint8Array<ArrayBuffer>
  Validity: Uint8Array<ArrayBuffer>
  ValidityType: IPNSEntry.ValidityType
  Sequence: bigint
  TTL: bigint
}

export interface IPNSResolveOptions extends AbortOptions, ProgressOptions<ResolveProgressEvents | IPNSRoutingProgressEvents> {
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

  /**
   * If true, ensure the record fields and signature are valid. If false, just
   * return the record.
   *
   * @default true
   */
  validate?: boolean
}

export interface RepublishOptions extends AbortOptions, ProgressOptions<IPNSRoutingProgressEvents> {
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
   * Automated record upkeep policy.
   *
   * Defaults to `rebroadcast` since `republish()` cannot sign new records
   * without the private key.
   *
   * - `rebroadcast`: re-publish the existing record until it expires
   * - `none`: disable automated publishing
   *
   * @default 'rebroadcast'
   */
  upkeep?: Exclude<UpkeepPolicy, 'reissue'>
}

export interface UnpublishOptions extends AbortOptions {
  /**
   * Also delete the record from the local store, so the node stops serving it
   * immediately instead of keeping it until it expires.
   *
   * @default false
   */
  removeRecord?: boolean
}

export interface IPNSResolveResult {
  /**
   * The resolved record
   */
  record: IPNSEntry

  /**
   * The value contained within the IPNS record
   */
  value: string
}

export interface IPNSPublishResult {
  /**
   * The published record
   */
  record: IPNSEntry

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
  record: IPNSEntry

  /**
   * The public key that the record is published under
   */
  publicKey: PublicKey
}

export interface IPNSResolver {
  /**
   * Accepts a CID with the libp2p-key codec and either the identity hash (for
   * Ed25519 and secp256k1 public keys) or a SHA256 hash (for RSA public keys),
   * or the multihash of a libp2p-key encoded CID and recursively resolves the
   * IPNS record corresponding to that key until a value is found.
   */
  resolve(key: CID | MultihashDigest, options?: IPNSResolveOptions): AsyncGenerator<IPNSResolveResult>
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
   * console.info(result) // { record, name, publicKey }
   * ```
   */
  publish(keyName: string, value: CID | PublicKey | MultihashDigest | string, options?: PublishOptions): Promise<IPNSPublishResult>

  /**
   * Accepts a multihash of a public key, a libp2p-key CID containing the
   * multihash of a public key, or an IPNS name in it's string representation
   * and recursively resolves IPNS records until a non-recursive record is found
   * (e.g. the value can be parsed as a string that does not start with
   * `/ipns/`).
   */
  resolve(name: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: IPNSResolveOptions): AsyncGenerator<IPNSResolveResult>

  /**
   * Stop automatically republishing an IPNS record
   *
   * By default this removes only the republishing metadata, keeping the record
   * in the datastore so it is still served until it expires. Pass
   * `removeRecord: true` to also delete the record so the node stops serving it.
   * If a key name is passed, the key remains in the keychain.
   */
  unpublish(key: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: UnpublishOptions): Promise<void>

  /**
   * Republish the record already in the local store, setting its upkeep policy.
   *
   * Sets the record's upkeep policy to `options.upkeep` (default `rebroadcast`)
   * so the background republisher keeps it available on the routers.
   *
   * @throws {NotFoundError} when there is no local record to republish
   * @throws {RecordObsoleteError} when the routers already have a newer record
   */
  republish(key: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, options?: RepublishOptions): Promise<RepublishResult>

  /**
   * Import an existing IPNS record into the local store without publishing it.
   *
   * The record is validated and stored so this node serves it on a GET, but it
   * is not broadcast to the routers. A newly imported record (for a key with no
   * existing upkeep policy) is not automatically republished; call `republish`
   * with an upkeep policy to start keeping it alive.
   *
   * Overwrites an older record already stored under this key, or rejects with
   * `RecordObsoleteError` if the stored record is newer. Importing never changes
   * the key's upkeep metadata, so a key that already has an upkeep policy keeps
   * it and continues to be republished automatically.
   *
   * @throws {RecordExpiredError} (or another validation error) when the record fails validation
   * @throws {RecordObsoleteError} when the stored record is more suitable than the one being imported
   */
  import(key: CID<unknown, 0x72> | PublicKey | MultihashDigest | string, record: IPNSEntry | Uint8Array, options?: AbortOptions): Promise<void>
}

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
    localStoreIPNSRouting(store),
    heliaIPNSRouting(components.routing),
    ...(options.routers ?? [])
  ]

  return new IPNSResolverClass(components, {
    routers,
    localStore: store
  })
}

export type { IPNSRoutingProgressEvents }
export { ipnsValidator } from './validator.ts'
export { ipnsSelector } from './selector.ts'
