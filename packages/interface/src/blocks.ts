import type { AbortOptions } from '@libp2p/interfaces'
import type { ProgressEvent, ProgressOptions } from 'progress-events'
import type { CID } from 'multiformats/cid'
import type { BitswapNotifyProgressEvents, BitswapWantProgressEvents } from 'ipfs-bitswap'
import type { AwaitIterable, Await } from './index.js'
import type { Blockstore } from 'interface-blockstore'

export interface Pair {
  cid: CID
  block: Uint8Array
}

export type PutBlockProgressEvents =
  ProgressEvent<'blocks:put:duplicate', CID> |
  ProgressEvent<'blocks:put:bitswap:notify', CID> |
  ProgressEvent<'blocks:put:blockstore:put', CID> |
  BitswapNotifyProgressEvents

export type PutManyBlocksProgressEvents =
  ProgressEvent<'blocks:put-many:duplicate', CID> |
  ProgressEvent<'blocks:put-many:bitswap:notify', CID> |
  ProgressEvent<'blocks:put-many:blockstore:put-many'> |
  BitswapNotifyProgressEvents

export type GetBlockProgressEvents =
  ProgressEvent<'blocks:get:bitswap:want', CID> |
  ProgressEvent<'blocks:get:blockstore:get', CID> |
  ProgressEvent<'blocks:get:blockstore:put', CID> |
  BitswapWantProgressEvents

export type GetManyBlocksProgressEvents =
  ProgressEvent<'blocks:get-many:blockstore:get-many'> |
  ProgressEvent<'blocks:get-many:bitswap:want', CID> |
  ProgressEvent<'blocks:get-many:blockstore:put', CID> |
  BitswapWantProgressEvents

export type GetAllBlocksProgressEvents =
  ProgressEvent<'blocks:get-all:blockstore:get-many'>

export type DeleteBlockProgressEvents =
  ProgressEvent<'blocks:delete:blockstore:delete', CID>

export type DeleteManyBlocksProgressEvents =
  ProgressEvent<'blocks:delete-many:blockstore:delete-many'>

export interface Blocks extends Blockstore {
  /**
   * Check for the existence of a value for the passed key
   *
   * @example
   * ```js
   * const exists = await store.has(CID('bafyfoo'))
   *
   * if (exists) {
   *   console.log('it is there')
   * } else {
   *   console.log('it is not there')
   * }
   *```
   */
  has: (key: CID, options?: AbortOptions) => Await<boolean>

  /**
   * Store the passed block under the passed CID
   *
   * @example
   *
   * ```js
   * await store.put(CID('bafyfoo'), new Uint8Array([0, 1, 2, 3]))
   * ```
   */
  put: (key: CID, val: Uint8Array, options?: AbortOptions & ProgressOptions<PutBlockProgressEvents>) => Await<void>

  /**
   * Store the given key/value pairs
   *
   * @example
   * ```js
   * const source = [{ cid: CID('bafyfoo'), block: new Uint8Array([0, 1, 2, 3]) }]
   *
   * for await (const { key, value } of store.putMany(source)) {
   *   console.info(`put content for key ${key}`)
   * }
   * ```
   */
  putMany: (
    source: AwaitIterable<Pair>,
    options?: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents>
  ) => AwaitIterable<Pair>

  /**
   * Retrieve the value stored under the given key
   *
   * @example
   * ```js
   * const value = await store.get(CID('bafyfoo'))
   * console.log('got content: %s', value.toString('utf8'))
   * // => got content: datastore
   * ```
   */
  get: (key: CID, options?: AbortOptions & ProgressOptions<GetBlockProgressEvents>) => Await<Uint8Array>

  /**
   * Retrieve values for the passed keys
   *
   * @example
   * ```js
   * for await (const value of store.getMany([CID('bafyfoo')])) {
   *   console.log('got content:', new TextDecoder('utf8').decode(value))
   *   // => got content: datastore
   * }
   * ```
   */
  getMany: (
    source: AwaitIterable<CID>,
    options?: AbortOptions & ProgressOptions<GetManyBlocksProgressEvents>
  ) => AwaitIterable<Uint8Array>

  /**
   * Retrieve all blocks in the blockstore
   *
   * @example
   * ```js
   * for await (const value of store.getAll()) {
   *   console.log('got content:', new TextDecoder('utf8').decode(value))
   *   // => got content: datastore
   * }
   * ```
   */
  getAll: (
    options?: AbortOptions & ProgressOptions<GetAllBlocksProgressEvents>
  ) => AwaitIterable<Pair>

  /**
   * Remove the record for the passed key
   *
   * @example
   *
   * ```js
   * await store.delete(CID('bafyfoo'))
   * console.log('deleted awesome content :(')
   * ```
   */
  delete: (key: CID, options?: AbortOptions & ProgressOptions<DeleteBlockProgressEvents>) => Await<void>

  /**
   * Remove values for the passed keys
   *
   * @example
   *
   * ```js
   * const source = [CID('bafyfoo')]
   *
   * for await (const key of store.deleteMany(source)) {
   *   console.log(`deleted content with key ${key}`)
   * }
   * ```
   */
  deleteMany: (
    source: AwaitIterable<CID>,
    options?: AbortOptions & ProgressOptions<DeleteManyBlocksProgressEvents>
  ) => AwaitIterable<CID>
}
