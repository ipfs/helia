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
import { name, version } from './version.ts'
import type { Helia } from '@helia/interface'
import type { HeliaInit } from '@helia/utils'
import type { CID } from 'multiformats/cid'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type { HeliaInit }

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): Generator<CID, void, undefined>
}

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
  const helia = new HeliaClass({
    name,
    version,
    ...init
  })

  return helia
}
