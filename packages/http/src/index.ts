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
 * import { createHeliaLight } from 'helia'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await withHTTP(createHeliaLight(), {
 *   delegatedRouters: [
 *     'https://delegated-ipfs.dev'
 *   ],
 *   recursiveGateways: [
 *     'https://trustless-gateway.link',
 *     'https://4everland.io'
 *   ]
 * }).start()
 *
 * const fs = unixfs(helia)
 * fs.cat(CID.parse('bafyFoo'))
 * ```
 * @example without using this module
 *
 * It's possible to manually configure your node without using this module.
 *
 * ```typescript
 * import { createHeliaLight } from 'helia'
 * import { trustlessGatewayBlockBroker } from '@helia/trustless-gateway-client'
 * import { fallbackRouter } from '@helia/fallback-router'
 * import { delegatedHTTPRouter } from '@helia/delegated-http-routing-client'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHeliaLight({
 *   blockBrokers: [
 *     trustlessGatewayBlockBroker()
 *   ],
 *   routers: [
 *     delegatedHTTPRouter({
 *       url: 'https://delegated-ipfs.dev'
 *     }),
 *     fallbackRouter({
 *       gateways: ['https://trustless-gateway.link', 'https://4everland.io']
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
import type { Helia } from '@helia/interface'
import type { TrustlessGatewayBlockBrokerInit } from '@helia/trustless-gateway-client'

export const DEFAULT_TRUSTLESS_GATEWAYS = [
  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs.github.io/public-gateway-checker/
  'https://trustless-gateway.link',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs.github.io/public-gateway-checker/
  'https://4everland.io'
]

export interface HTTPOptions extends TrustlessGatewayBlockBrokerInit {
  /**
   * Delegated routers are servers that make routing requests on behalf of peers
   * with less capable network connectivity.
   *
   * @see https://specs.ipfs.tech/routing/http-routing-v1/
   * @default ['https://delegated-ipfs.dev']
   */
  delegatedRouters?: string[]

  /**
   * A recursive gateway is one that will fetch content on behalf of peers with
   * less capable network connectivity. For example it may fetch content from a
   * node that supports transport(s) which the requesting peer does not.
   *
   * These are used as fallback routers which will always claim to be providers
   * of a given block.
   *
   * @see https://docs.ipfs.tech/concepts/ipfs-gateway/#recursive-vs-non-recursive-gateways
   */
  recursiveGateways?: string[]

  /**
   * List of protocols to filter in the PeerRecords as defined in IPIP-484
   * If undefined, PeerRecords are not filtered by protocol
   *
   * @see https://github.com/ipfs/specs/pull/484
   * @default undefined
   */
  filterProtocols?: string[]

  /**
   * Array of address filters to filter PeerRecords's addresses as defined in IPIP-484
   * If undefined, PeerRecords are not filtered by address
   *
   * @see https://github.com/ipfs/specs/pull/484
   * @default undefined
   */
  filterAddrs?: string[]
}

/**
 * Augment a Helia node with HTTP routers and block brokers
 */
export function withHTTP <H extends Helia> (helia: H, init?: HTTPOptions): H {
  (init?.delegatedRouters ?? [
    'https://delegated-ipfs.dev'
  ]).forEach(url => {
    helia.addRouter(delegatedHTTPRouter({
      ...init,
      url
    }))
  })

  // add recursive gateways as fallback if configured
  const recursiveGateways = init?.recursiveGateways ?? DEFAULT_TRUSTLESS_GATEWAYS
  if (recursiveGateways.length > 0) {
    helia.addRouter(fallbackRouter({
      gateways: recursiveGateways
    }))
  }

  // add trustless gateway block broker
  if (!helia.hasBlockBroker('trustless-gateway')) {
    helia.addBlockBroker(trustlessGatewayBlockBroker(init))
  }

  return helia
}
