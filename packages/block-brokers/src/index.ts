/**
 * @packageDocumentation
 *
 * ## Trustless Gateway Block Broker
 *
 * The TrustlessGatewayBlockBroker allows customizing fetch requests to HTTP gateways.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { trustlessGateway } from '@helia/block-brokers'
 * import { httpGatewayRouting } from '@helia/routers'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 *
 * const routing = httpGatewayRouting({
 *   gateways: ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/']
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
 * const cid = CID.parse('bafybeigdyrzt5sfp7udm7hu76kzwnh2n2p6evoqjbkgdojqagqauik5way')
 *
 * const content = await fs.cat(cid)
 *
 * ```
 */

export { bitswap } from './bitswap.js'
export type { BitswapBlockBrokerInit, BitswapBlockBrokerComponents } from './bitswap.js'
export { trustlessGateway } from './trustless-gateway/index.js'
export type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayBlockBrokerComponents, TrustlessGatewayGetBlockProgressEvents } from './trustless-gateway/index.js'
