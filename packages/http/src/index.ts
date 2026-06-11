/**
 * @packageDocumentation
 *
 * Exports a `withHTTP` function configures a {@link Helia} node that with block brokers and gateways that only run over HTTP.
 *
 * By default, content and peer routing are requests are resolved using the [Delegated HTTP Routing API](https://specs.ipfs.tech/routing/http-routing-v1/) and blocks are fetched from [Trustless Gateways](https://specs.ipfs.tech/http-gateways/trustless-gateway/).
 *
 * Pass it to other modules like {@link https://www.npmjs.com/package/@helia/unixfs | @helia/unixfs} to fetch files from the distributed web.
 *
 * @example
 *
 * ```typescript
 * import { withHTTP } from '@helia/http'
 * import { unixfs } from '@helia/unixfs'
 * import { createHelia } from 'helia'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await withHTTP(createHelia()).start()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 * @example without using this module
 *
 * It's possible to manually configure your node without using this module.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { trustlessGatewayBlockBroker } from '@helia/trustless-gateway-client'
 * import { fallbackRouter } from '@helia/fallback-router'
 * import { delegatedHTTPRouter } from '@helia/delegated-http-routing-client'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia({
 *   blockBrokers: [
 *     trustlessGatewayBlockBroker()
 *   ],
 *   routers: [
 *     delegatedHTTPRouter({
 *       url: 'https://delegated-ipfs.dev'
 *     }),
 *     fallbackRouter({
 *       gateways: ['https://cloudflare-ipfs.com', 'https://ipfs.io']
 *     })
 *   ]
 * }).start()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 */

import { delegatedHTTPRouter } from '@helia/delegated-routing-client'
import { fallbackRouter } from '@helia/fallback-router'
import { trustlessGatewayBlockBroker } from '@helia/trustless-gateway-client'
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
    fallbackRouter(),
    delegatedHTTPRouter({
      url: 'https://delegated-ipfs.dev'
    })
  ].forEach(router => {
    helia.addRouter(router)
  })

  init?.blockBrokers ?? [
    trustlessGatewayBlockBroker()
  ].forEach(broker => {
    helia.addBlockBroker(broker)
  })

  return helia
}
