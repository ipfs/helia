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

import { createInfo } from './commands/info.js'
import { createBitswap } from 'ipfs-bitswap'
import { BlockStorage } from './utils/block-storage.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Datastore } from 'interface-datastore'
import type { MultihashHasher } from 'multiformats/hashes/interface'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { identity } from 'multiformats/hashes/identity'

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

  /**
   * By default sha256, sha512 and identity hashes are supported for
   * bitswap operations. To bitswap blocks with CIDs using other hashes
   * pass appropriate MultihashHashers here.
   */
  hashers?: MultihashHasher[]
}

/**
 * Create and return a Helia node
 */
export async function createHelia (init: HeliaInit): Promise<Helia> {
  const hashers: MultihashHasher[] = [
    sha256,
    sha512,
    identity,
    ...(init.hashers ?? [])
  ]

  const bitswap = createBitswap(init.libp2p, init.blockstore, {
    hashLoader: {
      getHasher: async (codecOrName: string | number) => {
        const hasher = hashers.find(hasher => {
          return hasher.code === codecOrName || hasher.name === codecOrName
        })

        if (hasher != null) {
          return await Promise.resolve(hasher)
        }

        throw new Error(`Could not load hasher for code/name "${codecOrName}"`)
      }
    }
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
