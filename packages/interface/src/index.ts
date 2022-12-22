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
import type { CID } from 'multiformats/cid'
import type { ReadableStream } from 'node:stream/web'
import type { AbortOptions } from '@libp2p/interfaces'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Multiaddr } from '@multiformats/multiaddr'

export interface FileSystem {
  cat: (cid: CID, options?: CatOptions) => ReadableStream<Uint8Array>
}

/**
 * The API presented by a Helia node.
 */
export interface Helia {
  /**
   * Returns information about this node
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   *
   * const node = await createHelia()
   * const id = await node.id()
   * console.info(id)
   * // { peerId: PeerId(12D3Foo), ... }
   * ```
   */
  id: (options?: IdOptions) => Promise<IdResponse>

  /**
   * The cat method reads files sequentially, returning the bytes as a stream.
   *
   * If the passed CID does not resolve to a file, an error will be thrown.
   */
  cat: (cid: CID, options?: CatOptions) => ReadableStream<Uint8Array>

  /**
   * The underlying libp2p node
   */
  libp2p: Libp2p

  /**
   * Where the blocks are stored
   */
  blockstore: Blockstore
}

export interface CatOptions extends AbortOptions {
  offset?: number
  length?: number
}

export interface IdOptions extends AbortOptions {
  peerId?: PeerId
}

export interface IdResponse {
  peerId: PeerId
  multiaddrs: Multiaddr[]
  agentVersion: string
  protocolVersion: string
  protocols: string[]
}
