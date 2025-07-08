/**
 * @packageDocumentation
 *
 * This module contains utility code that is shared between various Helia
 * modules such as `helia`, `@helia/http`, etc.
 */

import { contentRoutingSymbol, peerRoutingSymbol, start, stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { dns } from '@multiformats/dns'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { PinsImpl } from './pins.js'
import { Routing as RoutingClass } from './routing.js'
import { BlockStorage } from './storage.js'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.js'
import { getCodec } from './utils/get-codec.js'
import { getHasher } from './utils/get-hasher.js'
import { NetworkedStorage } from './utils/networked-storage.js'
import type { BlockStorageInit } from './storage.js'
import type { Await, CodecLoader, GCOptions, HasherLoader, Helia as HeliaInterface, Routing } from '@helia/interface'
import type { BlockBroker } from '@helia/interface/blocks'
import type { Pins } from '@helia/interface/pins'
import type { ComponentLogger, Libp2p, Logger, Metrics } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
import type { DNS } from '@multiformats/dns'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { Libp2pOptions } from 'libp2p'
import type { BlockCodec } from 'multiformats'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export { AbstractSession } from './abstract-session.js'
export type { AbstractCreateSessionOptions, BlockstoreSessionEvents, AbstractSessionComponents } from './abstract-session.js'

export type { BlockStorage, BlockStorageInit }

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit<T extends Libp2p = Libp2p> {
  /**
   * A libp2p node is required to perform network operations. Either a
   * pre-configured node or options to configure a node can be passed
   * here.
   *
   * If node options are passed, they will be merged with the default
   * config for the current platform. In this case all passed config
   * keys will replace those from the default config.
   *
   * The libp2p `start` option is not supported, instead please pass `start` in
   * the root of the HeliaInit object.
   */
  libp2p: T | Omit<Libp2pOptions<any>, 'start'>

  /**
   * Pass `false` to not start the Helia node
   */
  start?: boolean

  /**
   * By default Helia stores the node's PeerId in an encrypted form in a
   * libp2p keystore. These options control how that keystore is configured.
   */
  keychain?: KeychainInit

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
   * An optional function that can load a MultihashHasher on demand. May return
   * a promise.
   */
  loadHasher?(code: number): Await<MultihashHasher>

  /**
   * In order to pin CIDs that correspond to a DAG, it's necessary to know
   * how to traverse that DAG.  DAGWalkers take a block and yield any CIDs
   * encoded within that block.
   */
  codecs?: Array<BlockCodec<any, any>>

  /**
   * An optional function that can load a BlockCodec on demand. May return a
   * promise.
   */
  loadCodec?(code: number): Await<BlockCodec<any, any>>

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

  /**
   * A metrics object that can be used to collected arbitrary stats about node
   * usage.
   */
  metrics?: Metrics
}

interface Components {
  libp2p: Libp2p
  blockstore: Blockstore
  datastore: Datastore
  logger: ComponentLogger
  blockBrokers: BlockBroker[]
  routing: Routing
  dns: DNS
  metrics?: Metrics
  getCodec: CodecLoader
  getHasher: HasherLoader
}

export class Helia<T extends Libp2p> implements HeliaInterface<T> {
  public libp2p: T
  public blockstore: BlockStorage
  public datastore: Datastore
  public pins: Pins
  public logger: ComponentLogger
  public routing: Routing
  public getCodec: CodecLoader
  public getHasher: HasherLoader
  public dns: DNS
  public metrics?: Metrics
  private readonly log: Logger

  constructor (init: Omit<HeliaInit, 'start' | 'libp2p'> & { libp2p: T }) {
    this.logger = init.logger ?? defaultLogger()
    this.log = this.logger.forComponent('helia')
    this.getHasher = getHasher(init.hashers, init.loadHasher)
    this.getCodec = getCodec(init.codecs, init.loadCodec)
    this.dns = init.dns ?? dns()
    this.metrics = init.metrics
    this.libp2p = init.libp2p

    // @ts-expect-error routing is not set
    const components: Components = {
      blockstore: init.blockstore,
      datastore: init.datastore,
      logger: this.logger,
      libp2p: this.libp2p,
      blockBrokers: [],
      getHasher: this.getHasher,
      getCodec: this.getCodec,
      dns: this.dns,
      metrics: this.metrics,
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
    this.pins = new PinsImpl(init.datastore, networkedStorage, this.getCodec)
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
      this.routing,
      this.libp2p
    )
  }

  async stop (): Promise<void> {
    await stop(
      this.blockstore,
      this.datastore,
      this.routing,
      this.libp2p
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
          } catch (err: any) {
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
