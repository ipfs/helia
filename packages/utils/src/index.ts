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
 * import { Helia } from '@helia/utils'
 *
 * const node = new Helia({
 *   // ...options
 * })
 * ```
 */

import { contentRoutingSymbol, peerRoutingSymbol, start, stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { dns } from '@multiformats/dns'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { PinsImpl } from './pins.js'
import { Routing as RoutingClass } from './routing.js'
import { BlockStorage } from './storage.js'
import { defaultDagWalkers } from './utils/dag-walkers.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import { defaultHashers } from './utils/default-hashers.js'
import { NetworkedStorage } from './utils/networked-storage.js'
import type { DAGWalker, GCOptions, Helia as HeliaInterface, Routing } from '@helia/interface'
import type { BlockBroker } from '@helia/interface/blocks'
import type { Pins } from '@helia/interface/pins'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export { AbstractSession, type AbstractCreateSessionOptions } from './abstract-session.js'
export { BloomFilter } from './bloom-filter.js'

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit {
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
   * By default this lock is held on the current process and other processes
   * will contact this process for access.
   *
   * If Helia is being run in multiple processes, one process must hold the GC
   * lock so use this option to control which process that is.
   *
   * @default true
   */
  holdGcLock?: boolean

  /**
   * An optional logging component to pass to libp2p. If not specified the
   * default implementation from libp2p will be used.
   */
  logger?: ComponentLogger

  /**
   * Routers perform operations such as looking up content providers,
   * information about network peers or getting/putting records.
   */
  routers?: Array<Partial<Routing>>

  /**
   * During provider lookups, peers can be returned from routing implementations
   * with no multiaddrs.
   *
   * This can happen when they've been retrieved from network peers that only
   * store multiaddrs for a limited amount of time.
   *
   * When this happens the peer's info has to be looked up with a further query.
   *
   * To not have this query block the yielding of other providers returned with
   * multiaddrs, a separate queue is used to perform this lookup.
   *
   * This config value controls the concurrency of that queue.
   *
   * @default 5
   */
  providerLookupConcurrency?: number

  /**
   * Components used by subclasses
   */
  components?: Record<string, any>

  /**
   * An optional DNS implementation used to perform queries for DNS records.
   */
  dns?: DNS
}

interface Components {
  blockstore: Blockstore
  datastore: Datastore
  hashers: Record<number, MultihashHasher>
  dagWalkers: Record<number, DAGWalker>
  logger: ComponentLogger
  blockBrokers: BlockBroker[]
  routing: Routing
  dns: DNS
}

export class Helia implements HeliaInterface {
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins
  public logger: ComponentLogger
  public routing: Routing
  public dagWalkers: Record<number, DAGWalker>
  public hashers: Record<number, MultihashHasher>
  public dns: DNS
  private readonly log: Logger

  constructor (init: HeliaInit) {
    this.logger = init.logger ?? defaultLogger()
    this.log = this.logger.forComponent('helia')
    this.hashers = defaultHashers(init.hashers)
    this.dagWalkers = defaultDagWalkers(init.dagWalkers)
    this.dns = init.dns ?? dns()

    // @ts-expect-error routing is not set
    const components: Components = {
      blockstore: init.blockstore,
      datastore: init.datastore,
      hashers: this.hashers,
      dagWalkers: this.dagWalkers,
      logger: this.logger,
      blockBrokers: [],
      dns: this.dns,
      ...(init.components ?? {})
    }

    this.routing = components.routing = new RoutingClass(components, {
      routers: (init.routers ?? []).flatMap((router: any) => {
        // if the router itself is a router
        const routers = [
          router
        ]

        // if the router provides a libp2p-style ContentRouter
        if (router[contentRoutingSymbol] != null) {
          routers.push(router[contentRoutingSymbol])
        }

        // if the router provides a libp2p-style PeerRouter
        if (router[peerRoutingSymbol] != null) {
          routers.push(router[peerRoutingSymbol])
        }

        return routers
      }),
      providerLookupConcurrency: init.providerLookupConcurrency
    })

    const networkedStorage = new NetworkedStorage(components)
    this.pins = new PinsImpl(init.datastore, networkedStorage, this.dagWalkers)
    this.blockstore = new BlockStorage(networkedStorage, this.pins, {
      holdGcLock: init.holdGcLock ?? true
    })
    this.datastore = init.datastore

    components.blockBrokers = init.blockBrokers.map((fn) => {
      return fn(components)
    })
  }

  async start (): Promise<void> {
    await assertDatastoreVersionIsCurrent(this.datastore)
    await start(
      this.blockstore,
      this.datastore,
      this.routing
    )
  }

  async stop (): Promise<void> {
    await stop(
      this.blockstore,
      this.datastore,
      this.routing
    )
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
