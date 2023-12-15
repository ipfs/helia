/**
 * @packageDocumentation
 *
 * Exports a `createHeliaHTTP` function that returns an object that implements a lightweight {@link Helia} API.
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to make files available on the distributed web.
 *
 * @example
 *
 * ```typescript
 * import { createHeliaHTTP } from '@helia/http'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHeliaHTTP()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { HeliaHTTPImpl } from './helia-http.js'
import type { HeliaHTTP } from '@helia/interface/http'
import type { BlockBroker } from '@helia/interface/blocks'
import type { ComponentLogger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'
export * from '@helia/interface/blocks'
export * from '@helia/interface/pins'

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): AsyncGenerator<CID, void, undefined>
}

/**
 * Options used to create a Helia node.
 */
export interface HeliaHTTPInit {
  /**
   * The blockstore is where blocks are stored
   */
  blockstore?: Blockstore

  /**
   * The datastore is where data is stored
   */
  datastore?: Datastore

  /**
   * By default sha256, sha512 and identity hashes are supported for
   * bitswap operations. To bitswap blocks with CIDs using other hashes
   * pass appropriate MultihashHashers here.
   */
  hashers?: MultihashHasher[]

  /**
   * In order to pin CIDs that correspond to a DAG, it's necessary to know
   * how to traverse that DAG.  DAGWalkers take a block and yield any CIDs
   * encoded within that block.
   */
  dagWalkers?: DAGWalker[]

  /**
   * A list of strategies used to fetch blocks when they are not present in
   * the local blockstore
   */
  blockBrokers?: Array<(components: any) => BlockBroker>

  /**
   * Pass `false` to not start the Helia node
   */
    start?: boolean

  /**
   * Garbage collection requires preventing blockstore writes during searches
   * for unpinned blocks as DAGs are typically pinned after they've been
   * imported - without locking this could lead to the deletion of blocks while
   * they are being added to the blockstore.
   *
   * By default this lock is held on the main process (e.g. node cluster's
   * primary process, the renderer thread in browsers) and other processes will
   * contact the main process for access (worker processes in node cluster,
   * webworkers in the browser).
   *
   * If Helia is being run wholly in a non-primary process, with no other process
   * expected to access the blockstore (e.g. being run in the background in a
   * webworker), pass true here to hold the gc lock in this process.
   */
  holdGcLock?: boolean

  /**
   * An optional logging component to pass to libp2p. If not specified the
   * default implementation from libp2p will be used.
   */
  logger?: ComponentLogger
}

/**
 * Create and return a Helia node
 */
export async function createHeliaHTTP (init: HeliaHTTPInit): Promise<HeliaHTTP>
export async function createHeliaHTTP (init?: HeliaHTTPInit): Promise<HeliaHTTP>
export async function createHeliaHTTP (init: HeliaHTTPInit = {}): Promise<HeliaHTTP<unknown>> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  const helia = new HeliaHTTPImpl({
    ...init,
    datastore,
    blockstore
  })

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
