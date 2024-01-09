/**
 * @packageDocumentation
 *
 * Exports a `Helia` class that implements the {@link HeliaInterface} API.
 *
 * In general you should use the `helia` or `@helia/http` modules instead which
 * pre-configure Helia for certain use-cases (p2p or pure-HTTP).
 *
 * @example
 *
 * ```typescript
 * import { Helia } from '@helia/core'
 *
 * const node = new Helia({
 *   // ...options
 * })
 * ```
 */

import { start, stop } from '@libp2p/interface'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { PinsImpl } from './pins.js'
import { BlockStorage } from './storage.js'
import { defaultDagWalkers } from './utils/dag-walkers.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import { defaultHashers } from './utils/default-hashers.js'
import { NetworkedStorage } from './utils/networked-storage.js'
import type { DAGWalker, GCOptions, Helia as HeliaInterface } from '@helia/interface'
import type { BlockBroker } from '@helia/interface/blocks'
import type { Pins } from '@helia/interface/pins'
import type { ComponentLogger, Libp2p, Logger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit<T extends Libp2p = Libp2p> {
  /**
   * A libp2p node is required to perform network operations. Either a
   * preconfigured node or options to configure a node can be passed
   * here.
   *
   * If node options are passed, they will be merged with the default
   * config for the current platform. In this case all passed config
   * keys will replace those from the default config.
   */
  libp2p: T

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

  /**
   * In order to pin CIDs that correspond to a DAG, it's necessary to know
   * how to traverse that DAG.  DAGWalkers take a block and yield any CIDs
   * encoded within that block.
   */
  dagWalkers?: DAGWalker[]

  /**
   * A list of strategies used to fetch blocks when they are not present in
   * the local blockstore
   */
  blockBrokers: Array<(components: any) => BlockBroker>

  /**
   * Garbage collection requires preventing blockstore writes during searches
   * for unpinned blocks as DAGs are typically pinned after they've been
   * imported - without locking this could lead to the deletion of blocks while
   * they are being added to the blockstore.
   *
   * By default this lock is held on the main process (e.g. node cluster's
   * primary process, the renderer thread in browsers) and other processes will
   * contact the main process for access (worker processes in node cluster,
   * webworkers in the browser).
   *
   * If Helia is being run wholly in a non-primary process, with no other process
   * expected to access the blockstore (e.g. being run in the background in a
   * webworker), pass true here to hold the gc lock in this process.
   */
  holdGcLock?: boolean

  /**
   * An optional logging component to pass to libp2p. If not specified the
   * default implementation from libp2p will be used.
   */
  logger?: ComponentLogger
}

export class Helia implements HeliaInterface {
  public libp2p: Libp2p
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins
  public logger: ComponentLogger
  private readonly log: Logger

  constructor (init: HeliaInit) {
    this.logger = init.libp2p.logger
    this.log = this.logger.forComponent('helia')
    const hashers = defaultHashers(init.hashers)

    const components = {
      blockstore: init.blockstore,
      datastore: init.datastore,
      libp2p: init.libp2p,
      hashers,
      logger: init.libp2p.logger
    }

    const blockBrokers = init.blockBrokers.map((fn) => {
      return fn(components)
    })

    const networkedStorage = new NetworkedStorage(components, {
      blockBrokers,
      hashers
    })

    this.pins = new PinsImpl(init.datastore, networkedStorage, defaultDagWalkers(init.dagWalkers))

    this.libp2p = init.libp2p
    this.blockstore = new BlockStorage(networkedStorage, this.pins, {
      holdGcLock: init.holdGcLock
    })
    this.datastore = init.datastore
  }

  async start (): Promise<void> {
    await assertDatastoreVersionIsCurrent(this.datastore)
    await start(this.blockstore)
    await this.libp2p.start()
  }

  async stop (): Promise<void> {
    await this.libp2p.stop()
    await stop(this.blockstore)
  }

  async gc (options: GCOptions = {}): Promise<void> {
    const releaseLock = await this.blockstore.lock.writeLock()

    try {
      const helia = this
      const blockstore = this.blockstore.unwrap()

      this.log('gc start')

      await drain(blockstore.deleteMany((async function * (): AsyncGenerator<CID> {
        for await (const { cid } of blockstore.getAll()) {
          try {
            if (await helia.pins.isPinned(cid, options)) {
              continue
            }

            yield cid

            options.onProgress?.(new CustomProgressEvent<CID>('helia:gc:deleted', cid))
          } catch (err) {
            helia.log.error('Error during gc', err)
            options.onProgress?.(new CustomProgressEvent<Error>('helia:gc:error', err))
          }
        }
      }())))
    } finally {
      releaseLock()
    }

    this.log('gc finished')
  }
}

export function isLibp2p (obj: any): obj is Libp2p {
  if (obj == null) {
    return false
  }

  // a non-exhaustive list of methods found on the libp2p object
  const funcs = ['dial', 'dialProtocol', 'hangUp', 'handle', 'unhandle', 'getMultiaddrs', 'getProtocols']

  // if these are all functions it's probably a libp2p object
  return funcs.every(m => typeof obj[m] === 'function')
}
