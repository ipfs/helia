import { start, stop } from '@libp2p/interface'
import { InvalidConfigurationError } from '../errors.ts'
import { SessionStorage } from './session-storage.ts'
import { Storage } from './storage.ts'
import type { StorageComponents, StorageInit } from './storage.ts'
import type { BlockBroker, Blocks, CreateSessionOptions, SessionBlockstore } from '@helia/interface/blocks'
import type { AbortOptions, Startable } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export interface GetOptions extends AbortOptions {
  progress?(evt: Event): void
}

export type NetworkedStorageComponents = StorageComponents<BlockBroker>

/**
 * Networked storage wraps a regular blockstore - when getting blocks if the
 * blocks are not present, the configured BlockBrokers will be used to fetch them.
 */
export class NetworkedStorage extends Storage<BlockBroker> implements Blocks, Startable {
  private started: boolean

  /**
   * Create a new BlockStorage
   */
  constructor (components: NetworkedStorageComponents, init: StorageInit = {}) {
    super(components, init)

    this.started = false
  }

  isStarted (): boolean {
    return this.started
  }

  async start (): Promise<void> {
    await start(this.child, ...this.blockBrokers)
    this.started = true
  }

  async stop (): Promise<void> {
    await stop(this.child, ...this.blockBrokers)
    this.started = false
  }

  unwrap (): Blockstore {
    return this.child
  }

  createSession (root: CID, options?: CreateSessionOptions): SessionBlockstore {
    if (this.blockBrokers.length === 0) {
      throw new InvalidConfigurationError('No block brokers configured')
    }

    const blockBrokers = this.blockBrokers
      .map(broker => broker.createSession?.(options))
      .filter(broker => broker != null)

    if (blockBrokers.length === 0) {
      throw new InvalidConfigurationError(`No configured block brokers support sessions - tried ${this.blockBrokers.map(b => b.name).join(', ')}`)
    }

    return new SessionStorage({
      blockstore: this.child,
      blockBrokers,
      getHasher: this.getHasher,
      logger: this.logger
    }, {
      root
    })
  }
}
