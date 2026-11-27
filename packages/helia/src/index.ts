/**
 * @packageDocumentation
 *
 * Exports a `createHelia` function that returns an object that implements the {@link Helia} API.
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to make files available on the distributed web.
 *
 * To create a node without `@helia/libp2p` or `@helia/bitswap`, and without
 * loading them, import `createHeliaLight` from `helia/light` instead. To add
 * your own libp2p node to it, use `withLibp2pLight` from `@helia/libp2p/light`.
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
 *
 * @example Providing content
 *
 * Adding blocks to a Helia node does not announce them to the network. To let
 * other peers discover that this node can supply a CID, provide it explicitly.
 *
 * Provided CIDs are re-announced periodically for as long as the node is
 * running, until `helia.routing.cancelReprovide(cid)` is called or the block is
 * deleted from the blockstore.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia().start()
 * const fs = unixfs(helia)
 *
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
 *
 * // make the CID discoverable by other peers
 * await helia.routing.provide(cid)
 * ```
 *
 * Other peers also need to be able to dial this node to fetch the blocks,
 * which is not always possible for nodes running in web browsers.
 */

import { withBitswap } from '@helia/bitswap'
import { withHTTP } from '@helia/http'
import { withLibp2p } from '@helia/libp2p'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import * as json from 'multiformats/codecs/json'
import { sha512 } from 'multiformats/hashes/sha2'
import { createHeliaLight } from './light.ts'
import type { HeliaInit } from './light.ts'
import type { BitswapOptions } from '@helia/bitswap'
import type { HTTPOptions } from '@helia/http'
import type { CreateLibp2pOptions, DefaultLibp2pServices, HeliaWithLibp2p } from '@helia/libp2p'
import type { ServiceMap } from '@libp2p/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { HeliaInit }
export { createHeliaLight }

/**
 * Create and return a Helia node using the default configuration including
 * libp2p and HTTP routing.
 *
 * For full control and smaller bundle sizes, use `createHeliaLight` from
 * `helia/light`.
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
export function createHelia <M extends ServiceMap> (init: HeliaInit & { libp2p?: CreateLibp2pOptions<M>, http?: HTTPOptions, bitswap?: BitswapOptions } = {}): HeliaWithLibp2p<DefaultLibp2pServices & M> {
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
  }), init.http), init.libp2p), init.bitswap)
}
