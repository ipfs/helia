/**
 * @packageDocumentation
 *
 * Exports a `createHeliaLight` function that returns a minimally configured
 * object that implements the {@link Helia} API.
 *
 * Unlike the main `helia` entry point, importing `helia/light` does not load
 * `@helia/libp2p` or `@helia/bitswap`, so use it when you want a node without
 * libp2p (or with your own libp2p config) and the smallest possible bundle.
 *
 * @example Creating a Helia node
 *
 * ```ts
 * import { createHeliaLight } from 'helia/light'
 * import { withHTTP } from '@helia/http'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await withHTTP(createHeliaLight()).start()
 * const fs = unixfs(helia)
 * const cid = CID.parse('QmFoo...')
 *
 * for await (const buf of fs.cat(cid, {
 *   signal: AbortSignal.timeout(5_000)
 * })) {
 *   console.info(buf)
 * }
 * ```
 */

import { Helia as HeliaClass } from './helia.ts'
import { name, version } from './version.ts'
import type { HeliaInit } from './helia.ts'
import type { Helia } from '@helia/interface'

export type { HeliaInit }

/**
 * Create and return a Helia node without any routing or block broker config.
 *
 * The only supported codecs are `dag-pb` and `raw`, and the only supported
 * hashes are `sha2-256` and `identity`.
 *
 * This allows more flexible customization and the smallest possible bundle size
 * in web browsers.
 *
 * @example Creating a Helia node
 *
 * ```ts
 * import { createHeliaLight } from 'helia/light'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHeliaLight()
 * const fs = unixfs(helia)
 * const cid = CID.parse('QmFoo...')
 *
 * for await (const buf of fs.cat(cid, {
 *   signal: AbortSignal.timeout(5_000)
 * })) {
 *   console.info(buf)
 * }
 * ```
 */
export function createHeliaLight (init: HeliaInit = {}): Helia {
  const helia = new HeliaClass({
    name,
    version,
    ...init
  })

  return helia
}
