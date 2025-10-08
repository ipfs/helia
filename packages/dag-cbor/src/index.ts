/**
 * @packageDocumentation
 *
 * `@helia/dag-cbor` makes working with DAG-CBOR {@link https://ipld.io/docs/codecs/known/dag-cbor/} simple & straightforward.
 *
 * See the {@link DAGCBOR} interface for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { dagCbor } from '@helia/dag-cbor'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 *
 * const d = dagCbor(helia)
 * const cid = await d.add({
 *   hello: 'world'
 * })
 * const obj = await d.get(cid)
 *
 * console.info(obj)
 * // { hello: 'world' }
 * ```
 */

import { CID } from 'multiformats/cid'
import { DAGCBOR as DAGCBORClass } from './dag-cbor.js'
import type { GetBlockProgressEvents, ProviderOptions, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

export interface DAGCBORComponents {
  blockstore: Blockstore
}

export interface AddOptions extends AbortOptions, ProgressOptions<PutBlockProgressEvents> {
  hasher?: MultihashHasher
}

export interface GetOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents>, ProviderOptions {

}

/**
 * The JSON interface provides a simple and intuitive way to add/get objects
 * with your Helia node and is a great place to start learning about IPFS.
 */
export interface DAGCBOR {
  /**
   * Add an object to your Helia node and get a CID that refers to the block the
   * object has been stored as.
   *
   * @example
   *
   * ```typescript
   * import { dagCbor } from '@helia/dag-cbor'
   *
   * const d = dagCbor(helia)
   * const cid = await d.add({ hello: 'world' })
   *
   * console.info(cid)
   * // CID(bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae)
   * ```
   */
  add(str: unknown, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Get an object from your Helia node, either previously added to it or to
   * another node on the network.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { dagCbor } from '@helia/dag-cbor'
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   *
   * const d = dagCbor(helia)
   * const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')
   * const obj = await d.get(cid)
   *
   * console.info(obj)
   * // { hello: 'world' }
   * ```
   */
  get<T>(cid: CID, options?: Partial<GetOptions>): Promise<T>
}

/**
 * Create a {@link DAGCBOR} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function dagCbor (helia: { blockstore: Blockstore }): DAGCBOR {
  return new DAGCBORClass(helia)
}
