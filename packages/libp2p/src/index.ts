/**
 * @packageDocumentation
 *
 * Adds libp2p functionality to Helia
 *
 * @example With default config
 *
 * ```ts
 * import { createHelia } from 'helia'
 * import { withLibp2p } from '@helia/libp2p'
 *
 * const node = await withLibp2p(createHelia()).start()
 *
 * console.info(node.libp2p.peerId) // 12D3Koo...
 * ```
 *
 * @example Custom config
 *
 * By default `withLibp2p` configures a libp2p node for the current environment.
 *
 * Each option passed replaces the default for that key. Pass `config: 'merge'`
 * to merge the options into the default config instead.
 *
 * For full control over your node (and the bundle size), use `withLibp2pLight`
 * from `@helia/libp2p/light`. That entry point does not load the default
 * config or any of its dependencies:
 *
 * ```ts
 * import { createHeliaLight } from 'helia/light'
 * import { withLibp2pLight } from '@helia/libp2p/light'
 *
 * const node = await withLibp2pLight(createHeliaLight(), {
 *   //... libp2p config here
 * }).start()
 *
 * console.info(node.libp2p.peerId) // 12D3Koo...
 * ```
 */

import { libp2pRouting, withLibp2pLight } from './light.ts'
import { libp2pDefaults } from './utils/libp2p-defaults.ts'
import type { CreateLibp2pOptions, HeliaWithLibp2p } from './light.ts'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
import type { Helia } from '@helia/interface'
import type { ServiceMap } from '@libp2p/interface'

export { libp2pRouting, withLibp2pLight }
export type { CreateLibp2pOptions, HeliaWithLibp2p }
export { libp2pDefaults } from './utils/libp2p-defaults.ts'
export type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'

/**
 * Return a Helia node augmented with a libp2p instance
 */
export function withLibp2p <H extends Helia> (helia: H): H & HeliaWithLibp2p<DefaultLibp2pServices>
export function withLibp2p <H extends Helia, M extends ServiceMap> (helia: H, opts?: CreateLibp2pOptions<M>): H & HeliaWithLibp2p<DefaultLibp2pServices & M>
export function withLibp2p <H extends Helia> (helia: H, opts?: any): H & HeliaWithLibp2p<DefaultLibp2pServices> {
  return withLibp2pLight(helia, libp2pDefaults(opts))
}
