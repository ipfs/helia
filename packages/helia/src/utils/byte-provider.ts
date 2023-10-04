import { logger } from '@libp2p/logger'
import forEach from 'it-foreach'
import type { Pair, GetOfflineOptions, BlockProvider } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { CID } from 'multiformats/cid'

const log = logger('helia:byte-provider')

export interface GetOptions extends AbortOptions {
  progress?: (evt: Event) => void
}

/**
 * ByteProvider is a partial implementation of the Blocks interface that
 *
 */
// export class ByteProvider implements Pick<Blocks, 'get' | 'getMany'> {
export class ByteProvider {
  private readonly blockstore: Blockstore
  readonly #provider: BlockProvider

  /**
   * Create a new BlockStorage
   */
  constructor (blockstore: Blockstore, provider: BlockProvider) {
    this.blockstore = blockstore
    this.#provider = provider
  }

  /**
   * Get a block by cid
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
