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

import type { Blocks } from './blocks.js'
import type { Pins } from './pins.js'
import type { Routing } from './routing.js'
import type { AbortOptions, ComponentLogger, Metrics } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { Datastore } from 'interface-datastore'
import type { Await } from 'interface-store'
import type { BlockCodec, MultihashHasher } from 'multiformats'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type { Await, AwaitIterable } from 'interface-store'

export interface CodecLoader {
  <T = any, Code extends number = any>(code: Code): Await<BlockCodec<Code, T>>
}

export interface HasherLoader {
  (code: number): Await<MultihashHasher>
}

/**
 * The API presented by a Helia node
 */
export interface Helia {
  /**
   * Where the blocks are stored
   */
  blockstore: Blocks

  /**
   * A key/value store
   */
  datastore: Datastore

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
   * Starts the Helia node
   */
  start(): Promise<void>

  /**
   * Stops the Helia node
   */
  stop(): Promise<void>

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
}

export type GcEvents =
  ProgressEvent<'helia:gc:deleted', CID> |
  ProgressEvent<'helia:gc:error', Error>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}

export * from './blocks.js'
export * from './errors.js'
export * from './pins.js'
export * from './routing.js'
