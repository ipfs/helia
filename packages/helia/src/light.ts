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
 * To add your own libp2p config without loading the default transports, pair
 * it with `withLibp2pLight` from `@helia/libp2p/light`.
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
 * By default the only supported codecs are `dag-pb` and `raw`, and the only
 * supported hashes are `sha2-256` and `identity`. Pass `codecs` and `hashers`
 * (or `loadCodec` and `loadHasher`) to support more.
 *
 * This allows more flexible customization and the smallest possible bundle size
 * in web browsers.
 *
 * @example Creating an offline Helia node
 *
 * With no routers or block brokers the node can only read blocks that are
 * already in its blockstore.
 *
 * ```ts
 * import { createHeliaLight } from 'helia/light'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHeliaLight().start()
 * const fs = unixfs(helia)
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
 *
 * for await (const buf of fs.cat(cid)) {
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
