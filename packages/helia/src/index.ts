/**
 * @packageDocumentation
 *
 * Create a Helia node.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { CID } from 'multiformats/cid'
 *
 * const node = await createHelia()
 *
 * node.cat(CID.parse('bafyFoo'))
 * ```
 */

import { createInfo } from './commands/info.js'
import { createBitswap } from 'ipfs-bitswap'
import { BlockStorage } from './utils/block-storage.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Datastore } from 'interface-datastore'

export interface CatOptions extends AbortOptions {
  offset?: number
  length?: number
}

export interface HeliaComponents {
  libp2p: Libp2p
  blockstore: Blockstore
  datastore: Datastore
}

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit {
  /**
   * A libp2p node is required to perform network operations
   */
  libp2p: Libp2p

  /**
   * The blockstore is where blocks are stored
   */
  blockstore: Blockstore

  /**
   * The datastore is where data is stored
   */
  datastore: Datastore
}

/**
 * Create and return a Helia node.
 *
 * @param {HeliaInit} init
 * @returns {Promise<Helia>}
 */
export async function createHelia (init: HeliaInit): Promise<Helia> {
  const bitswap = createBitswap(init.libp2p, init.blockstore, {

  })
  bitswap.start()

  const components: HeliaComponents = {
    libp2p: init.libp2p,
    blockstore: new BlockStorage(init.blockstore, bitswap),
    datastore: init.datastore
  }

  const helia: Helia = {
    libp2p: init.libp2p,
    blockstore: components.blockstore,
    datastore: init.datastore,

    info: createInfo(components),

    stop: async () => {
      bitswap.stop()
      await init.libp2p.stop()
    }
  }

  return helia
}
