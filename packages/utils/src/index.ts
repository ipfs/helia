/**
 * @packageDocumentation
 *
 * This module contains utility code that is shared between various Helia
 * modules such as `helia`, `@helia/http`, etc.
 */

import { keychain } from '@ipshipyard/keychain'
import { start, stop, TypedEventEmitter } from '@libp2p/interface'
import { dns } from '@multiformats/dns'
import { defaultLogger } from 'birnam'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import drain from 'it-drain'
import { CustomProgressEvent } from 'progress-events'
import { PinsImpl } from './pins.ts'
import { Routing as RoutingClass } from './routing.ts'
import { BlockStorage } from './storage.ts'
import { assertDatastoreVersionIsCurrent } from './utils/datastore-version.ts'
import { getCodec } from './utils/get-codec.ts'
import { getCrypto } from './utils/get-crypto.ts'
import { getHasher } from './utils/get-hasher.ts'
import { NetworkedStorage } from './utils/networked-storage.ts'
import type { BlockStorageInit } from './storage.ts'
import type { CodecLoader, GCOptions, HasherLoader, Helia as HeliaInterface, HeliaEvents, Routing, CryptoLoader, Crypto, NodeInfo, Router, HeliaMixin } from '@helia/interface'
import type { BlockBroker } from '@helia/interface'
import type { Pins } from '@helia/interface'
import type { Keychain, KeychainInit } from '@ipshipyard/keychain'
import type { ComponentLogger, Logger, Metrics } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { BlockCodec } from 'multiformats'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

export { AbstractSession } from './abstract-session.ts'
export type { AbstractCreateSessionOptions, BlockstoreSessionEvents, AbstractSessionComponents } from './abstract-session.ts'

export { isCID } from './utils/is-cid.ts'

export type { BlockStorage, BlockStorageInit }

export { breadthFirstWalker, depthFirstWalker, naturalOrderWalker } from './graph-walker.ts'
export type { GraphWalkerComponents, GraphWalkerInit, GraphNode, GraphWalker } from './graph-walker.ts'

/**
 * Options used to create a Helia node.
 */
export interface HeliaInit {
  /**
   * By default Helia stores the node's PeerId in an encrypted form in a
   * libp2p keystore. These options control how that keystore is configured.
   */
  keychain?: KeychainInit

  /**
   * The blockstore is where blocks are stored
   */
  blockstore?: Blockstore

  /**
   * The datastore is where data is stored
   */
  datastore?: Datastore

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
  loadHasher?(code: number): MultihashHasher | Promise<MultihashHasher>

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
  loadCodec?(code: number): BlockCodec<any, any> | Promise<BlockCodec<any, any>>

  /**
   * A list of pre-supported public/private key implementations
   */
  cryptos?: Array<Crypto>

  /**
   * Dynamically load a cryptography implementation
   */
  loadCrypto?: CryptoLoader

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
   * A list of strategies used to fetch blocks when they are not present in
   * the local blockstore
   */
  blockBrokers?: Array<BlockBroker | ((components: any) => BlockBroker)>

  /**
   * Routers perform operations such as looking up content providers,
   * information about network peers or getting/putting records.
   */
  routers?: Array<Router | ((components: any) => Router)>

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

  /**
   * Limit the maximum supported size of identity hash digests to this value
   *
   * @default 128
   */
  maxIdentityHashDigestLength?: number
}

interface Components {
  blockstore: Blockstore
  datastore: Datastore
  logger: ComponentLogger
  blockBrokers: BlockBroker[]
  routing: Routing
  dns: DNS
  keychain: Keychain
  metrics?: Metrics
  getCodec: CodecLoader
  getHasher: HasherLoader
  getCrypto: CryptoLoader
}

export class Helia implements HeliaInterface {
  public info: NodeInfo
  public blockstore: BlockStorage
  public datastore: Datastore
  public events: TypedEventEmitter<HeliaEvents<this>>
  public pins: Pins
  public logger: ComponentLogger
  public routing: RoutingClass
  public getCodec: CodecLoader
  public getHasher: HasherLoader
  public getCrypto: CryptoLoader
  public dns: DNS
  public keychain: Keychain
  public metrics?: Metrics
  public status: 'stopped' | 'stopping' | 'starting' | 'started'
  private readonly log: Logger
  private readonly blockBrokers: BlockBroker[]
  private readonly mixins: HeliaMixin[]

  constructor (init: HeliaInit & { name: string, version: string }) {
    this.info = {
      name: init.name,
      version: init.version
    }
    this.logger = init.logger ?? defaultLogger()
    this.log = this.logger.forComponent('helia')
    this.getHasher = getHasher(init.hashers, init.loadHasher)
    this.getCodec = getCodec(init.codecs, init.loadCodec)
    this.getCrypto = getCrypto(init.cryptos, init.loadCrypto)
    this.dns = init.dns ?? dns()
    this.metrics = init.metrics
    this.events = new TypedEventEmitter<HeliaEvents<typeof this>>()
    this.status = 'stopped'
    this.mixins = []

    // @ts-expect-error routing and keychain are not set
    const components: Components = {
      blockstore: init.blockstore ?? new MemoryBlockstore(),
      datastore: init.datastore ?? new MemoryDatastore(),
      logger: this.logger,
      blockBrokers: [],
      getHasher: this.getHasher,
      getCodec: this.getCodec,
      getCrypto: this.getCrypto,
      dns: this.dns,
      metrics: this.metrics,
      ...(init.components ?? {})
    }

    this.keychain = components.keychain = keychain()(components)

    this.routing = components.routing = new RoutingClass(components, {
      routers: (init.routers ?? []).flatMap((router: Router | ((components: any) => Router)) => {
        if (typeof router === 'function') {
          router = router(components)
        }

        // if the router itself is a router
        const routers = [
          router
        ]

        return routers
      }),
      providerLookupConcurrency: init.providerLookupConcurrency
    })

    this.blockBrokers = components.blockBrokers = (init.blockBrokers ?? []).map((broker) => {
      if (typeof broker === 'function') {
        broker = broker(components)
      }

      return broker
    })

    const networkedStorage = new NetworkedStorage(components, init)
    this.pins = new PinsImpl(components.datastore, networkedStorage, this.getCodec)
    this.blockstore = new BlockStorage(networkedStorage, this.pins, this.routing, {
      holdGcLock: init.holdGcLock ?? true
    })
    this.datastore = components.datastore
  }

  hasRouter (name: string): boolean {
    return this.routing.hasRouter(name)
  }

  addRouter (router: Router): void {
    this.routing.addRouter(router)
  }

  hasBlockBroker (name: string): boolean {
    return this.blockBrokers.findIndex(b => b.name === name) !== -1
  }

  addBlockBroker (blockBroker: BlockBroker): void {
    this.blockBrokers.push(blockBroker)
  }

  addMixin (mixin: HeliaMixin): void {
    this.mixins.push(mixin)
  }

  async start (): Promise<this> {
    this.status = 'starting'

    await assertDatastoreVersionIsCurrent(this.datastore)
    await start(
      this.blockstore,
      this.datastore,
      this.routing,
      ...this.blockBrokers
    )

    for (const mixin of this.mixins) {
      await mixin.start?.(this)
    }

    this.status = 'started'
    this.events.dispatchEvent(new CustomEvent('start', { detail: this }))

    return this
  }

  async stop (): Promise<this> {
    this.status = 'stopping'

    for (const mixin of this.mixins) {
      await mixin.stop?.(this)
    }

    await stop(
      this.blockstore,
      this.datastore,
      this.routing,
      ...this.blockBrokers
    )

    this.status = 'stopped'
    this.events.dispatchEvent(new CustomEvent('stop', { detail: this }))

    return this
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
            helia.log.error('error during gc - %e', err)
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
