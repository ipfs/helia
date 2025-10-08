/**
 * @packageDocumentation
 *
 * `@helia/json` makes working with JSON in {@link https://github.com/ipfs/helia Helia} simple & straightforward.
 *
 * See the {@link JSON} interface for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { json } from '@helia/json'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 * const j = json(helia)
 *
 * const cid = await j.add({
 *   hello: 'world'
 * })
 * const obj = await j.get(cid)
 *
 * console.info(obj)
 * // { hello: 'world' }
 * ```
 */

import { CID } from 'multiformats/cid'
import { JSON as JSONClass } from './json.js'
import type { GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import type { ProgressOptions } from 'progress-events'

export interface JSONComponents {
  blockstore: Blockstore
}

export interface AddOptions extends AbortOptions, ProgressOptions<PutBlockProgressEvents> {
  hasher?: MultihashHasher
}

export interface GetOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {

}

/**
 * The JSON interface provides a simple and intuitive way to add/get objects
 * with your Helia node and is a great place to start learning about IPFS.
 */
export interface JSON {
  /**
   * Add an object to your Helia node and get a CID that refers to the block the
   * object has been stored as.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { json } from '@helia/json'
   *
   * const helia = await createHelia()
   * const j = json(helia)
   *
   * const cid = await str.add({ hello: 'world' })
   *
   * console.info(cid)
   * // CID(bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea)
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
   * import { json } from '@helia/json'
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   * const j = json(helia)
   *
   * const cid = CID.parse('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea')
   * const obj = await j.get(cid)
   *
   * console.info(obj)
   * // { hello: 'world' }
   * ```
   */
  get<T>(cid: CID, options?: Partial<GetOptions>): Promise<T>
}

/**
 * Create a {@link JSON} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function json (helia: { blockstore: Blockstore }): JSON {
  return new JSONClass(helia)
}
