import filter from 'it-filter'
import type { Blockstore } from 'interface-blockstore'
import type { Blocks, Pair, DeleteManyBlocksProgressEvents, DeleteBlockProgressEvents, GetBlockProgressEvents, GetManyBlocksProgressEvents, PutManyBlocksProgressEvents, PutBlockProgressEvents, GetAllBlocksProgressEvents } from '@helia/interface/blocks'
import type { Bitswap } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { AbortOptions } from '@libp2p/interfaces'
import type { AwaitIterable } from 'interface-store'
import type { Mortice } from 'mortice'
import createMortice from 'mortice'
import type { Pins } from '@helia/interface/pins'
import forEach from 'it-foreach'
import { CustomProgressEvent, ProgressOptions } from 'progress-events'

export interface BlockStorageInit {
  holdGcLock?: boolean
  bitswap?: Bitswap
}

export interface GetOptions extends AbortOptions {
  progress?: (evt: Event) => void
}

/**
 * BlockStorage is a hybrid blockstore that puts/gets blocks from a configured
 * blockstore (that may be on disk, s3, or something else). If the blocks are
 * not present Bitswap will be used to fetch them from network peers.
 */
export class BlockStorage implements Blocks {
  public lock: Mortice
  private readonly child: Blockstore
  private readonly bitswap?: Bitswap
  private readonly pins: Pins

  /**
   * Create a new BlockStorage
   */
  constructor (blockstore: Blockstore, pins: Pins, options: BlockStorageInit = {}) {
    this.child = blockstore
    this.bitswap = options.bitswap
    this.pins = pins
    this.lock = createMortice({
      singleProcess: options.holdGcLock
    })
  }

  unwrap (): Blockstore {
    return this.child
  }

  /**
   * Put a block to the underlying datastore
   */
  async put (cid: CID, block: Uint8Array, options: AbortOptions & ProgressOptions<PutBlockProgressEvents> = {}): Promise<CID> {
    const releaseLock = await this.lock.readLock()

    try {
      if (await this.child.has(cid)) {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:duplicate', cid))
        return cid
      }

      if (this.bitswap?.isStarted() === true) {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:bitswap:notify', cid))
        this.bitswap.notify(cid, block, options)
      }

      options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:blockstore:put', cid))

      return await this.child.put(cid, block, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Put a multiple blocks to the underlying datastore
   */
  async * putMany (blocks: AwaitIterable<{ cid: CID, block: Uint8Array }>, options: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents> = {}): AsyncIterable<CID> {
    const releaseLock = await this.lock.readLock()

    try {
      const missingBlocks = filter(blocks, async ({ cid }) => {
        const has = await this.child.has(cid)

        if (has) {
          options.onProgress?.(new CustomProgressEvent<CID>('blocks:put-many:duplicate', cid))
        }

        return !has
      })

      const notifyEach = forEach(missingBlocks, ({ cid, block }) => {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:put-many:bitswap:notify', cid))
        this.bitswap?.notify(cid, block, options)
      })

      options.onProgress?.(new CustomProgressEvent('blocks:put-many:blockstore:put-many'))
      yield * this.child.putMany(notifyEach, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Get a block by cid
   */
  async get (cid: CID, options: AbortOptions & ProgressOptions<GetBlockProgressEvents> = {}): Promise<Uint8Array> {
    const releaseLock = await this.lock.readLock()

    try {
      if (this.bitswap?.isStarted() != null && !(await this.child.has(cid))) {
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:bitswap:get', cid))
        const block = await this.bitswap.want(cid, options)

        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:blockstore:put', cid))
        await this.child.put(cid, block, options)

        return block
      }

      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:blockstore:get', cid))
      return await this.child.get(cid, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Get multiple blocks back from an (async) iterable of cids
   */
  async * getMany (cids: AwaitIterable<CID>, options: AbortOptions & ProgressOptions<GetManyBlocksProgressEvents> = {}): AsyncIterable<Pair> {
    const releaseLock = await this.lock.readLock()

    try {
      options.onProgress?.(new CustomProgressEvent('blocks:get-many:blockstore:get-many'))
      yield * this.child.getMany(forEach(cids, async (cid) => {
        if (this.bitswap?.isStarted() === true && !(await this.child.has(cid))) {
          options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:bitswap:get', cid))
          const block = await this.bitswap.want(cid, options)
          options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:blockstore:put', cid))
          await this.child.put(cid, block, options)
        }
      }))
    } finally {
      releaseLock()
    }
  }

  /**
   * Delete a block from the blockstore
   */
  async delete (cid: CID, options: AbortOptions & ProgressOptions<DeleteBlockProgressEvents> = {}): Promise<void> {
    const releaseLock = await this.lock.writeLock()

    try {
      if (await this.pins.isPinned(cid)) {
        throw new Error('CID was pinned')
      }

      options.onProgress?.(new CustomProgressEvent<CID>('blocks:delete:blockstore:delete', cid))
      await this.child.delete(cid, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Delete multiple blocks from the blockstore
   */
  async * deleteMany (cids: AwaitIterable<CID>, options: AbortOptions & ProgressOptions<DeleteManyBlocksProgressEvents> = {}): AsyncIterable<CID> {
    const releaseLock = await this.lock.writeLock()

    try {
      const storage = this

      options.onProgress?.(new CustomProgressEvent('blocks:delete-many:blockstore:delete-many'))
      yield * this.child.deleteMany((async function * () {
        for await (const cid of cids) {
          if (await storage.pins.isPinned(cid)) {
            throw new Error('CID was pinned')
          }

          yield cid
        }
      }()), options)
    } finally {
      releaseLock()
    }
  }

  async has (cid: CID, options: AbortOptions = {}): Promise<boolean> {
    const releaseLock = await this.lock.readLock()

    try {
      return await this.child.has(cid, options)
    } finally {
      releaseLock()
    }
  }

  async * getAll (options: AbortOptions & ProgressOptions<GetAllBlocksProgressEvents> = {}): AsyncIterable<Pair> {
    const releaseLock = await this.lock.readLock()

    try {
      options.onProgress?.(new CustomProgressEvent('blocks:get-all:blockstore:get-many'))
      yield * this.child.getAll(options)
    } finally {
      releaseLock()
    }
  }
}
