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

import { withBitswap } from '@helia/bitswap'
import { withHTTP } from '@helia/http'
import { withLibp2p } from '@helia/libp2p'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as json from 'multiformats/codecs/json'
import { sha512 } from 'multiformats/hashes/sha2'
import { Helia as HeliaClass } from './helia.ts'
import { name, version } from './version.ts'
import type { HeliaInit } from './helia.ts'
import type { Helia } from '@helia/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { HeliaInit }

/**
 * Create and return a Helia node
 *
 * @example Creating a Helia node
 *
 * ```ts
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
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
export function createHelia (init: HeliaInit = {}): Helia {
  return withBitswap(withLibp2p(withHTTP(createHeliaLight({
    ...init,
    codecs: [
      dagCbor,
      dagJson,
      json,
      ...(init.codecs ?? [])
    ],
    hashers: [
      sha512,
      ...(init.hashers ?? [])
    ]
  }))))
}

/**
 * Create and return a Helia node without and routing or block broker config.
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
 * import { createHeliaLight } from 'helia'
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
