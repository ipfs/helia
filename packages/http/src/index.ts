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
 *
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
 *     delegatedHTTPRouting({
 *       url: 'https://delegated-ipfs.dev'
 *     }),
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
import type { BlockBroker, Helia, Router } from '@helia/interface'

export interface HTTPOptions {
  routers?: Router[]
  blockBrokers?: BlockBroker[]
}

/**
 * Augment a Helia node with HTTP routers and block brokers
 */
export function withHTTP <H extends Helia> (helia: H, init?: HTTPOptions): H {
  init?.routers ?? [
    httpGatewayRouting(),
    delegatedHTTPRouting({
      url: 'https://delegated-ipfs.dev'
    })
  ].forEach(router => {
    helia.addRouter(router)
  })

  init?.blockBrokers ?? [
    trustlessGateway()
  ].forEach(broker => {
    helia.addBlockBroker(broker)
  })

  return helia
}
