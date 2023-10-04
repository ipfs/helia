import filter from 'it-filter'
import forEach from 'it-foreach'
import { CustomProgressEvent, type ProgressOptions } from 'progress-events'
import type { Blocks, Pair, DeleteManyBlocksProgressEvents, DeleteBlockProgressEvents, GetBlockProgressEvents, GetManyBlocksProgressEvents, PutManyBlocksProgressEvents, PutBlockProgressEvents, GetAllBlocksProgressEvents, GetOfflineOptions } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { Bitswap } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { ByteProvider } from './byte-provider.js'

export interface BlockStorageInit {
  holdGcLock?: boolean
  bitswap?: Bitswap
  byteProviders?: ByteProvider[]
}

export interface GetOptions extends AbortOptions {
  progress?: (evt: Event) => void
}

/**
 * Networked storage wraps a regular blockstore - when getting blocks if the
 * blocks are not present Bitswap will be used to fetch them from network peers.
 */
export class NetworkedStorage implements Blocks {
  private readonly child: Blockstore
  private readonly bitswap?: Bitswap
  readonly #byteProviders: ByteProvider[]

  /**
   * Create a new BlockStorage
   */
  constructor (blockstore: Blockstore, options: BlockStorageInit = {}) {
    this.child = blockstore
    this.bitswap = options.bitswap
    this.#byteProviders = options.byteProviders ?? []
  }

  unwrap (): Blockstore {
    return this.child
  }

  /**
   * Put a block to the underlying datastore
   */
  async put (cid: CID, block: Uint8Array, options: AbortOptions & ProgressOptions<PutBlockProgressEvents> = {}): Promise<CID> {
    if (await this.child.has(cid)) {
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:duplicate', cid))
      return cid
    }

    if (this.bitswap?.isStarted() === true) {
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:bitswap:notify', cid))
      this.bitswap.notify(cid, block, options)
    }

    options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:blockstore:put', cid))

    return this.child.put(cid, block, options)
  }

  /**
   * Put a multiple blocks to the underlying datastore
   */
  async * putMany (blocks: AwaitIterable<{ cid: CID, block: Uint8Array }>, options: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents> = {}): AsyncIterable<CID> {
    const missingBlocks = filter(blocks, async ({ cid }): Promise<boolean> => {
      const has = await this.child.has(cid)

      if (has) {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:put-many:duplicate', cid))
      }

      return !has
    })

    const notifyEach = forEach(missingBlocks, ({ cid, block }): void => {
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:put-many:bitswap:notify', cid))
      this.bitswap?.notify(cid, block, options)
    })

    options.onProgress?.(new CustomProgressEvent('blocks:put-many:blockstore:put-many'))
    yield * this.child.putMany(notifyEach, options)
  }

  async #_get (cid: CID, options: GetOfflineOptions & AbortOptions & (ProgressOptions<GetBlockProgressEvents> | ProgressOptions<GetManyBlocksProgressEvents>)): Promise<Uint8Array> {
    const blockGetPromises: Promise<Uint8Array>[] = []
    /**
     * We need to create a new AbortController that aborts when:
     * 1. options.signal is aborted
     * 2. any of the blockGetPromises are resolved
     */
    const byteProviderController = new AbortController()
    const newOptions = { ...options, signal: byteProviderController.signal }
    if (options.signal != null) {
      // abort the byteProvider signal when the options.signal is aborted
      options.signal.addEventListener('abort', (): void => {
        byteProviderController.abort()
      })
    }

    if (this.bitswap?.isStarted() === true) {
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:bitswap:get', cid))
      blockGetPromises.push(this.bitswap.want(cid, newOptions))
    }

    for (const provider of this.#byteProviders) {
      // if the signal has already been aborted, don't bother requesting from other providers.
      if (!byteProviderController.signal.aborted) {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:byte-provider:get', cid))
        const providerPromise = provider.get(cid, newOptions)
        providerPromise.then(() => {
          // if a provider resolves, abort the signal so we don't request bytes from any other providers
          byteProviderController.abort()
        })
        blockGetPromises.push(providerPromise)
      }
    }

    try {
      const block = await Promise.any(blockGetPromises)
      // cancel all other block get promises
      byteProviderController.abort()

      return block
    } catch (err) {
      throw new Error(`Could not get block for ${cid.toString()} from any provider`)
    }
  }

  /**
   * Get a block by cid
   */
  async get (cid: CID, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetBlockProgressEvents> = {}): Promise<Uint8Array> {
    if (options.offline !== true && !(await this.child.has(cid))) {
      const block = await this.#_get(cid, options)

      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:blockstore:put', cid))
      await this.child.put(cid, block, options)

      return block
    }

    options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:blockstore:get', cid))

    return this.child.get(cid, options)
  }

  /**
   * Get multiple blocks back from an (async) iterable of cids
   */
  async * getMany (cids: AwaitIterable<CID>, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetManyBlocksProgressEvents> = {}): AsyncIterable<Pair> {
    options.onProgress?.(new CustomProgressEvent('blocks:get-many:blockstore:get-many'))

    yield * this.child.getMany(forEach(cids, async (cid): Promise<void> => {
      if (options.offline !== true && this.bitswap?.isStarted() === true && !(await this.child.has(cid))) {
        const block = await this.#_get(cid, options)
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:blockstore:put', cid))
        await this.child.put(cid, block, options)
      }
    }))
  }

  /**
   * Delete a block from the blockstore
   */
  async delete (cid: CID, options: AbortOptions & ProgressOptions<DeleteBlockProgressEvents> = {}): Promise<void> {
    options.onProgress?.(new CustomProgressEvent<CID>('blocks:delete:blockstore:delete', cid))

    await this.child.delete(cid, options)
  }

  /**
   * Delete multiple blocks from the blockstore
   */
  async * deleteMany (cids: AwaitIterable<CID>, options: AbortOptions & ProgressOptions<DeleteManyBlocksProgressEvents> = {}): AsyncIterable<CID> {
    options.onProgress?.(new CustomProgressEvent('blocks:delete-many:blockstore:delete-many'))
    yield * this.child.deleteMany((async function * (): AsyncGenerator<CID> {
      for await (const cid of cids) {
        yield cid
      }
    }()), options)
  }

  async has (cid: CID, options: AbortOptions = {}): Promise<boolean> {
    return this.child.has(cid, options)
  }

  async * getAll (options: AbortOptions & ProgressOptions<GetAllBlocksProgressEvents> = {}): AsyncIterable<Pair> {
    options.onProgress?.(new CustomProgressEvent('blocks:get-all:blockstore:get-many'))
    yield * this.child.getAll(options)
  }
}
