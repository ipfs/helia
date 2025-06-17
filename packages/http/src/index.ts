/**
 * @packageDocumentation
 *
 * Exports a `createHeliaHTTP` function that returns an object that implements a lightweight version of the {@link Helia} API that functions only over HTTP.
 *
 * By default, content and peer routing are requests are resolved using the [Delegated HTTP Routing API](https://specs.ipfs.tech/routing/http-routing-v1/) and blocks are fetched from [Trustless Gateways](https://specs.ipfs.tech/http-gateways/trustless-gateway/).
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
 * @example with custom gateways and delegated routing endpoints
 * ```typescript
 * import { createHeliaHTTP } from '@helia/http'
 * import { trustlessGateway } from '@helia/block-brokers'
 * import { delegatedHTTPRouting, httpGatewayRouting } from '@helia/routers'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHeliaHTTP({
 *   blockBrokers: [
 *     trustlessGateway()
 *   ],
 *   routers: [
 *     delegatedHTTPRouting('https://delegated-ipfs.dev'),
 *     httpGatewayRouting({
 *       gateways: ['https://cloudflare-ipfs.com', 'https://ipfs.io']
 *     })
 *   ]
 * })
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { trustlessGateway } from '@helia/block-brokers'
import { delegatedHTTPRouting, httpGatewayRouting } from '@helia/routers'
import { Helia as HeliaClass } from '@helia/utils'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import type { Helia } from '@helia/interface'
import type { HeliaInit } from '@helia/utils'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export interface HeliaHTTPInit extends HeliaInit {
  /**
   * Whether to start the Helia node
   */
  start?: boolean
}

/**
 * Create and return the default options used to create a Helia node that only
 * uses HTTP services
 */
export async function heliaDefaults (init: Partial<HeliaHTTPInit> = {}): Promise<HeliaHTTPInit> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  return {
    ...init,
    datastore,
    blockstore,
    blockBrokers: init.blockBrokers ?? [
      trustlessGateway()
    ],
    routers: init.routers ?? [
      delegatedHTTPRouting('https://delegated-ipfs.dev'),
      httpGatewayRouting()
    ]
  }
}

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
      delegatedHTTPRouting('https://delegated-ipfs.dev'),
      httpGatewayRouting()
    ]
  })

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
