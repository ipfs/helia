/**
 * @packageDocumentation
 *
 * Exports a `createHelia` function that returns an object that implements the {@link Helia} API.
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to make files available on the distributed web.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { bitswap, trustlessGateway } from '@helia/block-brokers'
import { libp2pRouting } from '@helia/routers'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { HeliaP2P } from './helia-p2p.js'
import { libp2pDefaults } from './utils/libp2p-defaults.js'
import { createLibp2p } from './utils/libp2p.js'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.js'
import type { Helia } from '@helia/interface'
import type { BlockBroker } from '@helia/interface/blocks'
import type { ComponentLogger, Libp2p } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { Libp2pOptions } from 'libp2p'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { DefaultLibp2pServices }
export { libp2pDefaults }

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): Generator<CID, void, undefined>
}

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
   *
   * The libp2p `start` option is not supported, instead please pass `start` in
   * the root of the HeliaInit object.
   */
  libp2p?: T | Omit<Libp2pOptions, 'start'>

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
   * In order to pin CIDs that correspond to a DAG, it's necessary to know
   * how to traverse that DAG.  DAGWalkers take a block and yield any CIDs
   * encoded within that block.
   */
  dagWalkers?: DAGWalker[]

  /**
   * A list of strategies used to fetch blocks when they are not present in
   * the local blockstore
   */
  blockBrokers?: Array<(components: any) => BlockBroker>

  /**
   * Pass `false` to not start the Helia node
   */
  start?: boolean

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

  /**
   * By default Helia stores the node's PeerId in an encrypted form in a
   * libp2p keystore. These options control how that keystore is configured.
   */
  keychain?: KeychainInit
}

export interface HeliaLibp2p<T extends Libp2p = Libp2p<DefaultLibp2pServices>> extends Helia {
  libp2p: T
}

/**
 * Create and return a Helia node
 */
export async function createHelia <T extends Libp2p> (init: HeliaInit<T>): Promise<HeliaLibp2p<T>>
export async function createHelia (init?: HeliaInit<Libp2p<DefaultLibp2pServices>>): Promise<HeliaLibp2p<Libp2p<DefaultLibp2pServices>>>
export async function createHelia (init: HeliaInit = {}): Promise<HeliaLibp2p> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  let libp2p: Libp2p<DefaultLibp2pServices>

  if (isLibp2p(init.libp2p)) {
    libp2p = init.libp2p as any
  } else {
    libp2p = await createLibp2p<DefaultLibp2pServices>({
      ...init,
      libp2p: {
        ...init.libp2p,

        // ignore the libp2p start parameter as it should be on the main init
        // object instead
        start: undefined
      },
      datastore
    })
  }

  const helia = new HeliaP2P({
    ...init,
    libp2p,
    datastore,
    blockstore,
    blockBrokers: init.blockBrokers ?? [
      trustlessGateway(),
      bitswap()
    ],
    routers: [
      libp2pRouting(libp2p)
    ]
  })

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}

function isLibp2p (obj: any): obj is Libp2p {
  if (obj == null) {
    return false
  }

  // a non-exhaustive list of methods found on the libp2p object
  const funcs = ['dial', 'dialProtocol', 'hangUp', 'handle', 'unhandle', 'getMultiaddrs', 'getProtocols']

  // if these are all functions it's probably a libp2p object
  return funcs.every(m => typeof obj[m] === 'function')
}
