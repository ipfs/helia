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

import { logger } from '@libp2p/logger'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { HeliaImpl } from './helia.js'
import { createLibp2p } from './utils/libp2p.js'
import { name, version } from './version.js'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.js'
import type { Helia } from '@helia/interface'
import type { BlockBroker } from '@helia/interface/blocks'
import type { Libp2p } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { Libp2pOptions } from 'libp2p'
import type { CID } from 'multiformats/cid'
import type { MultihashHasher } from 'multiformats/hashes/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'
export * from '@helia/interface/blocks'
export * from '@helia/interface/pins'

const log = logger('helia')

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): AsyncGenerator<CID, void, undefined>
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
   */
  libp2p?: T | Libp2pOptions

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
}

/**
 * Create and return a Helia node
 */
export async function createHelia <T extends Libp2p> (init: HeliaInit<T>): Promise<Helia<T>>
export async function createHelia (init?: HeliaInit<Libp2p<DefaultLibp2pServices>>): Promise<Helia<Libp2p<DefaultLibp2pServices>>>
export async function createHelia (init: HeliaInit = {}): Promise<Helia<unknown>> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  let libp2p: Libp2p

  if (isLibp2p(init.libp2p)) {
    libp2p = init.libp2p
  } else {
    libp2p = await createLibp2p(datastore, init.libp2p)
  }

  const helia = new HeliaImpl({
    ...init,
    datastore,
    blockstore,
    libp2p
  })

  if (init.start !== false) {
    await helia.start()
  }

  // add helia to agent version
  addHeliaToAgentVersion(helia)

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

function addHeliaToAgentVersion (helia: Helia<any>): void {
  // add helia to agent version
  try {
    const existingAgentVersion = helia.libp2p.services.identify.host.agentVersion

    if (existingAgentVersion.match(/js-libp2p\/\d+\.\d+\.\d+\sUserAgent=/) == null) {
      // the user changed the agent version
      return
    }

    helia.libp2p.services.identify.host.agentVersion = `${name}/${version} ${helia.libp2p.services.identify.host.agentVersion}`
  } catch (err) {
    log.error('could not add Helia to agent version', err)
  }
}
