/**
 * @packageDocumentation
 *
 * Create a Helia node.
 *
 * @example
 *
 * ```typescript
 * import { createLibp2p } from 'libp2p'
 * import { MemoryDatastore } from 'datastore-core'
 * import { MemoryBlockstore } from 'blockstore-core'
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const node = await createHelia({
 *   blockstore: new MemoryBlockstore(),
 *   datastore: new MemoryDatastore(),
 *   libp2p: await createLibp2p({
 *     //... libp2p options
 *   })
 * })
 * const fs = unixfs(node)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import { HeliaImpl } from './helia.js'

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk: (block: Uint8Array) => AsyncGenerator<CID, void, undefined>
}

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit {
  /**
   * A libp2p node is required to perform network operations
   */
  libp2p?: Libp2p

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
}

/**
 * Create and return a Helia node
 */
export async function createHelia (init: HeliaInit = {}): Promise<Helia> {
  const helia = new HeliaImpl(init)

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
