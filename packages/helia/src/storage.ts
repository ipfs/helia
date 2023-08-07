import createMortice from 'mortice'
import type { Blocks, Pair, DeleteManyBlocksProgressEvents, DeleteBlockProgressEvents, GetBlockProgressEvents, GetManyBlocksProgressEvents, PutManyBlocksProgressEvents, PutBlockProgressEvents, GetAllBlocksProgressEvents, GetOfflineOptions } from '@helia/interface/blocks'
import type { Pins } from '@helia/interface/pins'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { Mortice } from 'mortice'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface BlockStorageInit {
  holdGcLock?: boolean
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
  private readonly pins: Pins

  /**
   * Create a new BlockStorage
   */
  constructor (blockstore: Blockstore, pins: Pins, options: BlockStorageInit = {}) {
    this.child = blockstore
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
      yield * this.child.putMany(blocks, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Get a block by cid
   */
  async get (cid: CID, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetBlockProgressEvents> = {}): Promise<Uint8Array> {
    const releaseLock = await this.lock.readLock()

    try {
      return await this.child.get(cid, options)
    } finally {
      releaseLock()
    }
  }

  /**
   * Get multiple blocks back from an (async) iterable of cids
   */
  async * getMany (cids: AwaitIterable<CID>, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetManyBlocksProgressEvents> = {}): AsyncIterable<Pair> {
    const releaseLock = await this.lock.readLock()

    try {
      yield * this.child.getMany(cids, options)
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

      yield * this.child.deleteMany((async function * (): AsyncGenerator<CID> {
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
      yield * this.child.getAll(options)
    } finally {
      releaseLock()
    }
  }
}
