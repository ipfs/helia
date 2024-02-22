import { CodeError, start, stop } from '@libp2p/interface'
import { anySignal } from 'any-signal'
import { IdentityBlockstore } from 'blockstore-core/identity'
import { TieredBlockstore } from 'blockstore-core/tiered'
import filter from 'it-filter'
import forEach from 'it-foreach'
import { CustomProgressEvent, type ProgressOptions } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { isPromise } from './is-promise.js'
import type { HasherLoader } from '@helia/interface'
import type { BlockBroker, Blocks, Pair, DeleteManyBlocksProgressEvents, DeleteBlockProgressEvents, GetBlockProgressEvents, GetManyBlocksProgressEvents, PutManyBlocksProgressEvents, PutBlockProgressEvents, GetAllBlocksProgressEvents, GetOfflineOptions, BlockRetriever, BlockAnnouncer, BlockRetrievalOptions } from '@helia/interface/blocks'
import type { AbortOptions, ComponentLogger, Logger, LoggerOptions, Startable } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { MultihashDigest, MultihashHasher } from 'multiformats/hashes/interface'

export interface GetOptions extends AbortOptions {
  progress?(evt: Event): void
}

function isBlockRetriever (b: any): b is BlockRetriever {
  return typeof b.retrieve === 'function'
}

function isBlockAnnouncer (b: any): b is BlockAnnouncer {
  return typeof b.announce === 'function'
}

export interface NetworkedStorageComponents {
  blockstore: Blockstore
  logger: ComponentLogger
  blockBrokers?: BlockBroker[]
  hashers?: Record<number, MultihashHasher>
  getHasher: HasherLoader
}

/**
 * Networked storage wraps a regular blockstore - when getting blocks if the
 * blocks are not present Bitswap will be used to fetch them from network peers.
 */
export class NetworkedStorage implements Blocks, Startable {
  private readonly child: Blockstore
  private readonly blockRetrievers: BlockRetriever[]
  private readonly blockAnnouncers: BlockAnnouncer[]
  private readonly getHasher: HasherLoader
  private started: boolean
  private readonly log: Logger

  /**
   * Create a new BlockStorage
   */
  constructor (components: NetworkedStorageComponents) {
    this.log = components.logger.forComponent('helia:networked-storage')
    this.child = new TieredBlockstore([
      new IdentityBlockstore(),
      components.blockstore
    ])
    this.blockRetrievers = (components.blockBrokers ?? []).filter(isBlockRetriever)
    this.blockAnnouncers = (components.blockBrokers ?? []).filter(isBlockAnnouncer)
    this.getHasher = components.getHasher
    this.started = false
  }

  isStarted (): boolean {
    return this.started
  }

  async start (): Promise<void> {
    await start(this.child, ...new Set([...this.blockRetrievers, ...this.blockAnnouncers]))
    this.started = true
  }

  async stop (): Promise<void> {
    await stop(this.child, ...new Set([...this.blockRetrievers, ...this.blockAnnouncers]))
    this.started = false
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

    options.onProgress?.(new CustomProgressEvent<CID>('blocks:put:providers:notify', cid))

    this.blockAnnouncers.forEach(provider => {
      provider.announce(cid, block, options)
    })

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
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:put-many:providers:notify', cid))
      this.blockAnnouncers.forEach(provider => {
        provider.announce(cid, block, options)
      })
    })

    options.onProgress?.(new CustomProgressEvent('blocks:put-many:blockstore:put-many'))
    yield * this.child.putMany(notifyEach, options)
  }

  /**
   * Get a block by cid
   */
  async get (cid: CID, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetBlockProgressEvents> = {}): Promise<Uint8Array> {
    if (options.offline !== true && !(await this.child.has(cid))) {
      const hasher = await this.getHasher(cid.multihash.code)

      // we do not have the block locally, get it from a block provider
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:providers:get', cid))
      const block = await raceBlockRetrievers(cid, this.blockRetrievers, hasher, {
        ...options,
        log: this.log
      })
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:blockstore:put', cid))
      await this.child.put(cid, block, options)

      // notify other block providers of the new block
      options.onProgress?.(new CustomProgressEvent<CID>('blocks:get:providers:notify', cid))
      this.blockAnnouncers.forEach(provider => {
        provider.announce(cid, block, options)
      })

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
      if (options.offline !== true && !(await this.child.has(cid))) {
        const hasher = await this.getHasher(cid.multihash.code)

        // we do not have the block locally, get it from a block provider
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:providers:get', cid))
        const block = await raceBlockRetrievers(cid, this.blockRetrievers, hasher, {
          ...options,
          log: this.log
        })
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:blockstore:put', cid))
        await this.child.put(cid, block, options)

        // notify other block providers of the new block
        options.onProgress?.(new CustomProgressEvent<CID>('blocks:get-many:providers:notify', cid))
        this.blockAnnouncers.forEach(provider => {
          provider.announce(cid, block, options)
        })
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

  async * getAll (options: AbortOptions & ProgressOptions<GetAllBlocksProgressEvents> = {}): AwaitIterable<Pair> {
    options.onProgress?.(new CustomProgressEvent('blocks:get-all:blockstore:get-many'))
    yield * this.child.getAll(options)
  }
}

export const getCidBlockVerifierFunction = (cid: CID, hasher: MultihashHasher): Required<BlockRetrievalOptions>['validateFn'] => {
  return async (block: Uint8Array): Promise<void> => {
    // verify block
    let hash: MultihashDigest<number>
    const res = hasher.digest(block)

    if (isPromise(res)) {
      hash = await res
    } else {
      hash = res
    }

    if (!uint8ArrayEquals(hash.digest, cid.multihash.digest)) {
      // if a hash mismatch occurs for a TrustlessGatewayBlockBroker, we should try another gateway
      throw new CodeError('Hash of downloaded block did not match multihash from passed CID', 'ERR_HASH_MISMATCH')
    }
  }
}

/**
 * Race block providers cancelling any pending requests once the block has been
 * found.
 */
async function raceBlockRetrievers (cid: CID, providers: BlockRetriever[], hasher: MultihashHasher, options: AbortOptions & LoggerOptions): Promise<Uint8Array> {
  const validateFn = getCidBlockVerifierFunction(cid, hasher)

  const controller = new AbortController()
  const signal = anySignal([controller.signal, options.signal])

  try {
    return await Promise.any(
      providers.map(async provider => {
        try {
          let blocksWereValidated = false
          const block = await provider.retrieve(cid, {
            ...options,
            signal,
            validateFn: async (block: Uint8Array): Promise<void> => {
              await validateFn(block)
              blocksWereValidated = true
            }
          })

          if (!blocksWereValidated) {
            // the blockBroker either did not throw an error when attempting to validate the block
            // or did not call the validateFn at all. We should validate the block ourselves
            await validateFn(block)
          }

          return block
        } catch (err) {
          options.log.error('could not retrieve verified block for %c', cid, err)
          throw err
        }
      })
    )
  } finally {
    signal.clear()
  }
}
