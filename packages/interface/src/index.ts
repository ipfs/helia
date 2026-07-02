/**
 * @packageDocumentation
 *
 * The API defined by a {@link Helia} node
 *
 * @example
 *
 * ```typescript
 * import type { Helia } from '@helia/interface'
 *
 * export function doSomething(helia: Helia) {
 *   // use helia node functions here
 * }
 * ```
 */

import type { BlockBroker, Blocks } from './blocks.ts'
import type { Pins } from './pins.ts'
import type { Router, Routing } from './routing.ts'
import type { CryptoLoader, Keychain } from '@ipshipyard/keychain'
import type { Metrics } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { AbortOptions } from 'abort-error'
import type { ComponentLogger } from 'birnam'
import type { Datastore } from 'interface-datastore'
import type { TypedEventEmitter } from 'main-event'
import type { BlockCodec, MultihashHasher } from 'multiformats'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export interface CodecLoader {
  <T = any, Code extends number = any>(code: Code, options?: AbortOptions): BlockCodec<Code, T> | Promise<BlockCodec<Code, T>>
}

export interface HasherLoader {
  (code: number, options?: AbortOptions): MultihashHasher | Promise<MultihashHasher>
}

export type { CryptoLoader, Keychain } from '@ipshipyard/keychain'
export type { Crypto, PrivateKey, PublicKey } from '@ipshipyard/crypto'
export { isPrivateKey, isPublicKey } from '@ipshipyard/crypto'

export interface NodeInfo {
  name: string
  version: string
}

export interface HeliaMixin<Start extends Helia = Helia, Stop = Start> {
  name: string
  start?(helia: Start): Promise<void> | void
  stop?(helia: Stop): Promise<void> | void
}

/**
 * The API presented by a Helia node
 */
export interface Helia {
  /**
   * Runtime information about the node
   */
  info: NodeInfo

  /**
   * Where the blocks are stored
   */
  blockstore: Blocks

  /**
   * A key/value store
   */
  datastore: Datastore

  /**
   * Event emitter for Helia start and stop events
   */
  events: TypedEventEmitter<HeliaEvents<this>>

  /**
   * Secure storage for private keys
   */
  keychain: Keychain

  /**
   * Pinning operations for blocks in the blockstore
   */
  pins: Pins

  /**
   * A logging component that can be reused by consumers
   */
  logger: ComponentLogger

  /**
   * The routing component allows performing operations such as looking up
   * content providers, information about peers, etc.
   */
  routing: Routing

  /**
   * The DNS property can be used to perform lookups of various record types and
   * will use a resolver appropriate to the current platform.
   */
  dns: DNS

  /**
   * A metrics object that can be used to collected arbitrary stats about node
   * usage.
   */
  metrics?: Metrics

  /**
   * The current status of the Helia node
   */
  status: 'starting' | 'started' | 'stopping' | 'stopped'

  /**
   * Starts the Helia node
   */
  start(options?: AbortOptions): Promise<this>

  /**
   * Stops the Helia node
   */
  stop(options?: AbortOptions): Promise<this>

  /**
   * Remove any unpinned blocks from the blockstore
   */
  gc(options?: GCOptions): Promise<void>

  /**
   * Load an IPLD codec. Implementations may return a promise if, for example,
   * the codec is being fetched from the network.
   */
  getCodec: CodecLoader

  /**
   * Hashers can be used to hash a piece of data with the specified hashing
   * algorithm. Implementations may return a promise if, for example,
   * the hasher is being fetched from the network.
   */
  getHasher: HasherLoader

  /**
   * Cryptography implementations securely sign and verify data
   */
  getCrypto: CryptoLoader

  /**
   * Returns `true` if a router with the passed name has been configured
   */
  hasRouter (name: string): boolean

  /**
   * Add a router
   */
  addRouter(router: Router | ((components: any) => Router)): void

  /**
   * Returns `true` if a block broker with the passed name has been configured
   */
  hasBlockBroker (name: string): boolean

  /**
   * Add a block broker
   */
  addBlockBroker(blockBroker: BlockBroker | ((components: any) => BlockBroker)): void

  /**
   * Add a mixin to extend runtime functionality
   */
  addMixin<T extends Helia = Helia & Record<string, any>>(mixin: HeliaMixin<T>): void
}

export type GcEvents =
  ProgressEvent<'helia:gc:deleted', CID> |
  ProgressEvent<'helia:gc:error', Error>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}

export interface HeliaEvents<H extends Helia = Helia> {
  /**
   * This event notifies listeners that the node has started
   *
   * ```TypeScript
   * helia.addEventListener('start', (event) => {
   *   console.info(event.detail.libp2p.isStarted()) // true
   * })
   * ```
   */
  start: CustomEvent<H>

  /**
   * This event notifies listeners that the node has stopped
   *
   * ```TypeScript
   * helia.addEventListener('stop', (event) => {
   *   console.info(event.detail.libp2p.isStarted()) // false
   * })
   * ```
   */
  stop: CustomEvent<H>
}

export * from './blocks.ts'
export * from './errors.ts'
export * from './graph-walker.ts'
export * from './pins.ts'
export * from './routing.ts'
