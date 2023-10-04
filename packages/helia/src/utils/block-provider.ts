import { logger } from '@libp2p/logger'
import forEach from 'it-foreach'
import type { Pair, GetOfflineOptions, ByteProvider } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { CID } from 'multiformats/cid'

const log = logger('helia:block-provider')

export interface GetOptions extends AbortOptions {
  progress?: (evt: Event) => void
}

/**
 * BlockProvider is a partial implementation of the Blocks interface that only handles block retrieval.
 *
 * This takes a {@link ByteProvider} and {@link Blockstore}. When a block is requested, it will first
 * check the blockstore for the block. If it is not found, it will then call the provider to get the bytes. Once the
 * bytes are retrieved, they are validated as a "block" and then that block is stored in the blockstore.
 *
 */
export class BlockProvider {
  private readonly blockstore: Blockstore
  readonly #provider: ByteProvider

  /**
   * Create a new BlockProvider
   */
  constructor (blockstore: Blockstore, provider: ByteProvider) {
    this.blockstore = blockstore
    this.#provider = provider
  }

  /**
   * Get a block by cid, using the given ByteProvider
   */
  async get (cid: CID, options: GetOfflineOptions & AbortOptions): Promise<Uint8Array> {
    if (options.offline !== true && !(await this.blockstore.has(cid))) {
      try {
        const block = await this.#provider.get(cid, options)

        await this.blockstore.put(cid, block, options)

        return block
      } catch (err) {
        log.error('failed to get block for %s', cid.toString(), err)
      }
    }

    return this.blockstore.get(cid, options)
  }

  /**
   * Get multiple blocks back from an (async) iterable of cids
   */
  async * getMany (cids: AwaitIterable<CID>, options: GetOfflineOptions & AbortOptions): AsyncIterable<Pair> {
    yield * this.blockstore.getMany(forEach(cids, async (cid): Promise<void> => {
      if (options.offline !== true && !(await this.blockstore.has(cid))) {
        const block = await this.#provider.get(cid, options)

        await this.blockstore.put(cid, block, options)
      }
    }))
  }
}
