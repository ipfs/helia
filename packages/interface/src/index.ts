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
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { Datastore } from 'interface-datastore'
import type { MultihashHasher } from 'multiformats'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type { Await, AwaitIterable } from 'interface-store'

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
   * DAGWalkers are codec-specific implementations that know how to yield all
   * CIDs contained within a block that corresponds to that codec.
   */
  dagWalkers: Record<number, DAGWalker>

  /**
   * Hashers can be used to hash a piece of data with the specified hashing
   * algorithm.
   */
  hashers: Record<number, MultihashHasher>

  /**
   * The DNS property can be used to perform lookups of various record types and
   * will use a resolver appropriate to the current platform.
   */
  dns: DNS

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
}

export type GcEvents =
  ProgressEvent<'helia:gc:deleted', CID> |
  ProgressEvent<'helia:gc:error', Error>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): Generator<CID, void, undefined>
}

export * from './blocks.js'
export * from './pins.js'
export * from './routing.js'
