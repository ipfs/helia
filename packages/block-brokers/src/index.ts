/**
 * @packageDocumentation
 *
 * ## Trustless Gateway Block Broker
 *
 * The TrustlessGatewayBlockBroker allows customizing fetch requests to HTTP gateways.
 *
 * @example Customizing fetch requests with custom headers
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { trustlessGateway } from '@helia/block-brokers'
 * import { httpGatewayRouting } from '@helia/routers'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 * import { concat } from 'uint8arrays/concat'
 * import all from 'it-all'
 *
 * const routing = httpGatewayRouting({
 *   gateways: ['https://ipfs.io', 'https://dweb.link']
 * })
 *
 * const helia = await createHelia({
 *   routers: [routing],
 *   blockBrokers: [
 *     trustlessGateway({
 *       transformRequestInit: (requestInit) => {
 *         requestInit.headers = {
 *           ...requestInit.headers,
 *           'User-Agent': 'Helia Example Script'
 *         }
 *         return requestInit
 *       }
 *     })
 *   ]
 * })
 *
 * const fs = unixfs(helia)
 * const cid = CID.parse('bafkreife2klsil6kaxqhvmhgldpsvk5yutzm4i5bgjoq6fydefwtihnesa')
 * const chunks = await all(fs.cat(cid))
 * const content = concat(chunks)
 *
 *
 * ```
 */

export { bitswap } from './bitswap.js'
export type { BitswapBlockBrokerInit, BitswapBlockBrokerComponents } from './bitswap.js'
export { trustlessGateway } from './trustless-gateway/index.js'
export type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayBlockBrokerComponents, TrustlessGatewayGetBlockProgressEvents } from './trustless-gateway/index.js'
