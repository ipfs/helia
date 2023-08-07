/**
 * @packageDocumentation
 *
 * The API defined by a Helia node
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
import type { Libp2p, AbortOptions } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

export type { Await, AwaitIterable } from 'interface-store'

/**
 * The API presented by a Helia node.
 */
export interface Helia<T = Libp2p> {
  /**
   * The underlying libp2p node
   */
  libp2p: T

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
   * Starts the Helia node
   */
  start: () => Promise<void>

  /**
   * Stops the Helia node
   */
  stop: () => Promise<void>

  /**
   * Remove any unpinned blocks from the blockstore
   */
  gc: (options?: GCOptions) => Promise<void>
}

export type GcEvents =
  ProgressEvent<'helia:gc:deleted', CID> |
  ProgressEvent<'helia:gc:error', Error>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}
