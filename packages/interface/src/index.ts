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

import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interfaces'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Datastore } from 'interface-datastore'
import type { Pins } from './pins.js'
import type { ProgressEvent, ProgressOptions } from 'progress-events'
import type { CID } from 'multiformats/cid'

/**
 * The API presented by a Helia node.
 */
export interface Helia {
  /**
   * The underlying libp2p node
   */
  libp2p: Libp2p

  /**
   * Where the blocks are stored
   */
  blockstore: Blockstore

  /**
   * A key/value store
   */
  datastore: Datastore

  /**
   * Pinning operations for blocks in the blockstore
   */
  pins: Pins

  /**
   * Returns information about this node
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   *
   * const node = await createHelia()
   * const id = await node.info()
   * console.info(id)
   * // { peerId: PeerId(12D3Foo), ... }
   * ```
   */
  info: (options?: InfoOptions) => Promise<InfoResponse>

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
  ProgressEvent<'helia:gc:deleted', CID>

export interface GCOptions extends AbortOptions, ProgressOptions<GcEvents> {

}

export interface InfoOptions extends AbortOptions {
  /**
   * If passed, return information about this PeerId, defaults
   * to the ID of the current node.
   */
  peerId?: PeerId
}

export interface InfoResponse {
  /**
   * The ID of the peer this info is about
   */
  peerId: PeerId

  /**
   * The multiaddrs the peer is listening on
   */
  multiaddrs: Multiaddr[]

  /**
   * The peer's reported agent version
   */
  agentVersion: string

  /**
   * The peer's reported protocol version
   */
  protocolVersion: string

  /**
   * The protocols the peer supports
   */
  protocols: string[]

  /**
   * The status of the node
   */
  status: 'running' | 'stopped'
}
