import { BaseBlockstore } from 'blockstore-core'
import merge from 'it-merge'
import { pushable } from 'it-pushable'
import filter from 'it-filter'
import type { Blockstore, KeyQuery, Query } from 'interface-blockstore'
import type { IPFSBitswap } from 'ipfs-bitswap'
import type { CID } from 'multiformats/cid'
import type { AbortOptions } from '@libp2p/interfaces'
import { CustomEvent } from '@libp2p/interfaces/events'

export interface BlockStorageOptions extends AbortOptions {
  progress?: (evt: Event) => void
}

/**
 * BlockStorage is a hybrid block datastore. It stores data in a local
 * datastore and may retrieve data from a remote Exchange.
 * It uses an internal `datastore.Datastore` instance to store values.
 */
export class BlockStorage extends BaseBlockstore implements Blockstore {
  private readonly child: Blockstore
  private readonly bitswap: IPFSBitswap

  /**
   * Create a new BlockStorage
   */
  constructor (blockstore: Blockstore, bitswap: IPFSBitswap) {
    super()

    this.child = blockstore
    this.bitswap = bitswap
  }

  async open (): Promise<void> {
    await this.child.open()
  }

  async close (): Promise<void> {
    await this.child.close()
  }

  unwrap (): Blockstore {
    return this.child
  }

  /**
   * Put a block to the underlying datastore
   */
  async put (cid: CID, block: Uint8Array, options: AbortOptions = {}): Promise<void> {
    if (await this.has(cid)) {
      return
    }

    if (this.bitswap.isStarted()) {
      await this.bitswap.put(cid, block, options)
    } else {
      await this.child.put(cid, block, options)
    }
  }

  /**
   * Put a multiple blocks to the underlying datastore
   */
  async * putMany (blocks: AsyncIterable<{ key: CID, value: Uint8Array }> | Iterable<{ key: CID, value: Uint8Array }>, options: AbortOptions = {}): AsyncGenerator<{ key: CID, value: Uint8Array }, void, undefined> {
    const missingBlocks = filter(blocks, async ({ key }) => { return !(await this.has(key)) })

    if (this.bitswap.isStarted()) {
      yield * this.bitswap.putMany(missingBlocks, options)
    } else {
      yield * this.child.putMany(missingBlocks, options)
    }
  }

  /**
   * Get a block by cid
   */
  async get (cid: CID, options: BlockStorageOptions = {}): Promise<Uint8Array> {
    if (!(await this.has(cid)) && this.bitswap.isStarted()) {
      if (options.progress != null) {
        options.progress(new CustomEvent<CID>('fetchFromBitswap', {
          detail: cid
        }))
      }

      return await this.bitswap.get(cid, options)
    } else {
      if (options.progress != null) {
        options.progress(new CustomEvent<CID>('fetchFromBlockstore', {
          detail: cid
        }))
      }

      return await this.child.get(cid, options)
    }
  }

  /**
   * Get multiple blocks back from an array of cids
   *
   * @param {AsyncIterable<CID> | Iterable<CID>} cids
   * @param {AbortOptions} [options]
   */
  async * getMany (cids: AsyncIterable<CID> | Iterable<CID>, options: BlockStorageOptions = {}): AsyncGenerator<Uint8Array, void, undefined> {
    const getFromBitswap = pushable<CID>({ objectMode: true })
    const getFromChild = pushable<CID>({ objectMode: true })

    void Promise.resolve().then(async () => {
      for await (const cid of cids) {
        if (!(await this.has(cid)) && this.bitswap.isStarted()) {
          if (options.progress != null) {
            options.progress(new CustomEvent<CID>('fetchFromBitswap', {
              detail: cid
            }))
          }

          getFromBitswap.push(cid)
        } else {
          if (options.progress != null) {
            options.progress(new CustomEvent<CID>('fetchFromBlockstore', {
              detail: cid
            }))
          }

          getFromChild.push(cid)
        }
      }

      getFromBitswap.end()
      getFromChild.end()
    }).catch(err => {
      getFromBitswap.throw(err)
    })

    yield * merge(
      this.bitswap.getMany(getFromBitswap, options),
      this.child.getMany(getFromChild, options)
    )
  }

  /**
   * Delete a block from the blockstore
   */
  async delete (cid: CID, options: AbortOptions = {}): Promise<void> {
    await this.child.delete(cid, options)
  }

  /**
   * Delete multiple blocks from the blockstore
   */
  async * deleteMany (cids: AsyncIterable<CID> | Iterable<CID>, options: AbortOptions = {}): AsyncGenerator<CID, void, undefined> {
    yield * this.child.deleteMany(cids, options)
  }

  async has (cid: CID, options: AbortOptions = {}): Promise<boolean> {
    return await this.child.has(cid, options)
  }

  async * query (q: Query, options: AbortOptions = {}): AsyncGenerator<{ key: CID, value: Uint8Array }, void, undefined> {
    yield * this.child.query(q, options)
  }

  async * queryKeys (q: KeyQuery, options: AbortOptions = {}): AsyncGenerator<CID, void, undefined> {
    yield * this.child.queryKeys(q, options)
  }
}
