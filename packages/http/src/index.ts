/**
 * @packageDocumentation
 *
 * Exports a `createHeliaHTTP` function that returns an object that implements a lightweight version of the {@link Helia} API that functions only over HTTP.
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to fetch files from the distributed web.
 *
 * @example
 *
 * ```typescript
 * import { createHeliaHTTP } from '@helia/http'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHeliaHTTP()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { trustlessGateway } from '@helia/block-brokers'
import { Helia as HeliaClass, type HeliaInit } from '@helia/core'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import type { Helia, Routing } from '@helia/interface'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'
export * from '@helia/interface/blocks'
export * from '@helia/interface/pins'

export interface HeliaHTTPInit extends HeliaInit {
  /**
   * Whether to start the Helia node
   */
  start?: boolean
}

/**
/**
 * Create and return a Helia node
 */
export async function createHeliaHTTP (init: Partial<HeliaHTTPInit> = {}): Promise<Helia> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  const helia = new HeliaClass({
    ...init,
    datastore,
    blockstore,
    blockBrokers: init.blockBrokers ?? [
      trustlessGateway()
    ],
    routers: init.routers ?? [
      // TODO: export a Routing implementation from @helia/delegated-routing-v1-http-api-client
      createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev') as Partial<Routing>
    ]
  })

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
