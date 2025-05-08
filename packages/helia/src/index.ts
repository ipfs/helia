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

import { HeliaP2P } from './helia-p2p.js'
import { heliaDefaults } from './utils/helia-defaults.js'
import { libp2pDefaults } from './utils/libp2p-defaults.js'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.js'
import type { Libp2pDefaultsOptions } from './utils/libp2p.js'
import type { Helia } from '@helia/interface'
import type { HeliaInit as HeliaClassInit } from '@helia/utils'
import type { Libp2p } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
import type { Libp2pOptions } from 'libp2p'
import type { CID } from 'multiformats/cid'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { DefaultLibp2pServices, Libp2pDefaultsOptions }

// allow amending the default config
export { libp2pDefaults }
export { heliaDefaults }

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
export interface HeliaInit<T extends Libp2p = Libp2p> extends HeliaClassInit {
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
  libp2p?: T | Omit<Libp2pOptions<any>, 'start'>

  /**
   * Pass `false` to not start the Helia node
   */
  start?: boolean

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
export async function createHelia <T extends Libp2p> (init: Partial<HeliaInit<T>>): Promise<HeliaLibp2p<T>>
export async function createHelia (init?: Partial<HeliaInit<Libp2p<DefaultLibp2pServices>>>): Promise<HeliaLibp2p<Libp2p<DefaultLibp2pServices>>>
export async function createHelia (init: Partial<HeliaInit> = {}): Promise<HeliaLibp2p> {
  const options = await heliaDefaults(init)
  const helia = new HeliaP2P<any>(options)

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
