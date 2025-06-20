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
import { httpGatewayRouting, libp2pRouting } from '@helia/routers'
import { Helia as HeliaClass } from '@helia/utils'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p, isLibp2p } from './utils/libp2p.ts'
import type { DefaultLibp2pServices } from './utils/libp2p-defaults.ts'
import type { Libp2pDefaultsOptions } from './utils/libp2p.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'
import type { HeliaInit } from 'helia'

// re-export interface types so people don't have to depend on @helia/interface
// if they don't want to
export * from '@helia/interface'

export type HeliaHTTPInit = HeliaInit<Libp2p<DefaultLibp2pServices>>

export type { DefaultLibp2pServices, Libp2pDefaultsOptions }

/**
 * Create and return the default options used to create a Helia node
 */
export async function heliaDefaults <T extends Libp2p> (init: Partial<HeliaInit<T>> = {}): Promise<HeliaInit<T> & Required<Pick<HeliaInit, 'libp2p' | 'blockstore'>>> {
  const datastore = init.datastore ?? new MemoryDatastore()
  const blockstore = init.blockstore ?? new MemoryBlockstore()

  let libp2p: any

  if (isLibp2p(init.libp2p)) {
    libp2p = init.libp2p as any
  } else {
    libp2p = await createLibp2p<DefaultLibp2pServices>({
      ...init,
      libp2p: {
        dns: init.dns,
        ...init.libp2p,

        // ignore the libp2p start parameter as it should be on the main init
        // object instead
        start: undefined
      },
      datastore
    })
  }

  return {
    ...init,
    libp2p,
    datastore,
    blockstore,
    blockBrokers: init.blockBrokers ?? [
      trustlessGateway()
    ],
    routers: init.routers ?? [
      libp2pRouting(libp2p),
      httpGatewayRouting()
    ],
    metrics: libp2p.metrics,
    start: init.start ?? true
  }
}



/**
 * Create and return a Helia node
 */
export async function createHeliaHTTP (init: Partial<HeliaHTTPInit> = {}): Promise<Helia> {
  const options = await heliaDefaults(init)

  const helia = new HeliaClass<Libp2p<DefaultLibp2pServices>>({
    ...options
  })

  if (init.start !== false) {
    await helia.start()
  }

  return helia
}
