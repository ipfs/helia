import { setMaxListeners } from '@libp2p/interface'
import { anySignal } from 'any-signal'
import { Storage } from './storage.ts'
import type { StorageComponents } from './storage.ts'
import type { Pair, DeleteManyBlocksProgressEvents, DeleteBlockProgressEvents, GetBlockProgressEvents, GetManyBlocksProgressEvents, PutManyBlocksProgressEvents, PutBlockProgressEvents, GetAllBlocksProgressEvents, GetOfflineOptions, SessionBlockstore, SessionBlockBroker } from '@helia/interface/blocks'
import type { AbortOptions, PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { InputPair } from 'interface-blockstore'
import type { AwaitIterable } from 'interface-store'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface SessionStorageInit {
  root: CID
}

/**
 * Storage subclass that can cancel any ongoing operation at any point.
 */
export class SessionStorage extends Storage<SessionBlockBroker> implements SessionBlockstore {
  private readonly closeController: AbortController

  constructor (components: StorageComponents<SessionBlockBroker>, init: SessionStorageInit) {
    super(components)

    // because brokers are allowed to continue searching for providers after the
    // session has been created, we need a way to tell them that the user has
    // finished using the session any in-flight requests should be cancelled
    this.closeController = new AbortController()
    setMaxListeners(Infinity, this.closeController.signal)

    this.log = components.logger.forComponent(`helia:session-storage:${init.root}`)
  }

  close (): void {
    this.closeController.abort()
  }

  async addPeer (peer: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<void> {
    await Promise.all(
      this.blockBrokers
        .map(broker => broker.addPeer(peer, options))
    )
  }

  /**
   * Put a block to the underlying datastore
   */
  async put (cid: CID, block: Uint8Array, options: AbortOptions & ProgressOptions<PutBlockProgressEvents> = {}): Promise<CID> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      return await super.put(cid, block, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Put a multiple blocks to the underlying datastore
   */
  async * putMany (blocks: AwaitIterable<InputPair>, options: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents> = {}): AsyncGenerator<CID> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      yield * super.putMany(blocks, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Get a block by cid
   */
  async * get (cid: CID, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetBlockProgressEvents> = {}): AsyncGenerator<Uint8Array> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      yield * super.get(cid, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Get multiple blocks back from an (async) iterable of cids
   */
  async * getMany (cids: AwaitIterable<CID>, options: GetOfflineOptions & AbortOptions & ProgressOptions<GetManyBlocksProgressEvents> = {}): AsyncGenerator<Pair> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      yield * super.getMany(cids, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Delete a block from the blockstore
   */
  async delete (cid: CID, options: AbortOptions & ProgressOptions<DeleteBlockProgressEvents> = {}): Promise<void> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      await super.delete(cid, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  /**
   * Delete multiple blocks from the blockstore
   */
  async * deleteMany (cids: AwaitIterable<CID>, options: AbortOptions & ProgressOptions<DeleteManyBlocksProgressEvents> = {}): AsyncGenerator<CID> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      yield * super.deleteMany(cids, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  async has (cid: CID, options: AbortOptions = {}): Promise<boolean> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      return await super.has(cid, {
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }

  async * getAll (options: AbortOptions & ProgressOptions<GetAllBlocksProgressEvents> = {}): AsyncGenerator<Pair> {
    const signal = anySignal([this.closeController.signal, options.signal])
    setMaxListeners(Infinity, signal)

    try {
      yield * super.getAll({
        ...options,
        signal
      })
    } finally {
      signal.clear()
    }
  }
}
