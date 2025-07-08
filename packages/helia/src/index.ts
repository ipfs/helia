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

import { Helia as HeliaClass } from '@helia/utils'
import { heliaDefaults } from './utils/helia-defaults.js'
import { libp2pDefaults } from './utils/libp2p-defaults.js'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.js'
import type { Libp2pDefaultsOptions } from './utils/libp2p.js'
import type { Helia } from '@helia/interface'
import type { HeliaInit } from '@helia/utils'
import type { Libp2p } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { HeliaInit }

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
 * Helia with a libp2p node
 *
 * @deprecated Use the `Helia` type instead. This will be removed in the next major version.
 */
export type HeliaLibp2p = Helia

/**
 * Create and return a Helia node
 */
export async function createHelia <T extends Libp2p> (init: Partial<HeliaInit<T>>): Promise<Helia<T>>
export async function createHelia (init?: Partial<HeliaInit<Libp2p<DefaultLibp2pServices>>>): Promise<Helia<Libp2p<DefaultLibp2pServices>>>
export async function createHelia (init: Partial<HeliaInit> = {}): Promise<Helia> {
  const options = await heliaDefaults(init)
  const helia = new HeliaClass(options)

  if (options.start !== false) {
    await helia.start()
  }

  return helia
}
