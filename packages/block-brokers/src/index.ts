/**
 * @packageDocumentation
 *
 * This module contains Helia block brokers, currently for [bitswap](https://docs.ipfs.tech/concepts/bitswap/)
 * and [Trustless Gateways](https://specs.ipfs.tech/http-gateways/trustless-gateway/).
 *
 * ## Trustless Gateway Block Broker
 *
 * The TrustlessGatewayBlockBroker fetches blocks from HTTP gateways.
 *
 * @example Customizing fetch requests with custom headers
 *
 * It is possible to modify outgoing requests to (for example) include
 * authentication information (such as a JWT token in a header).
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { trustlessGateway } from '@helia/block-brokers'
 * import { unixfs } from '@helia/unixfs'
 * import { CID } from 'multiformats/cid'
 * import { concat } from 'uint8arrays/concat'
 * import all from 'it-all'
 *
 * const helia = await createHelia({
 *   blockBrokers: [
 *     trustlessGateway({
 *       transformRequestInit: (requestInit) => {
 *         // modify the request init object as required
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
 * const cid = CID.parse('bafkreife2klsil6kaxqhvmhgldpsvk5yutzm4i5bgjoq6fydefwtihnesa')
 * const fs = unixfs(helia)
 *
 * for await (const chunk of fs.cat(cid, {
 *   signal: AbortSignal.timeout(10_000)
 * })) {
 *   console.info(chunk)
 * }
 * ```
 */

export { bitswap } from './bitswap.js'
export type { BitswapBlockBrokerInit, BitswapBlockBrokerComponents } from './bitswap.js'
export { trustlessGateway } from './trustless-gateway/index.js'
export type { TrustlessGatewayBlockBrokerInit, TrustlessGatewayBlockBrokerComponents, TrustlessGatewayGetBlockProgressEvents, TrustlessGatewayProvider } from './trustless-gateway/index.js'
export type { BitswapProvider } from '@helia/bitswap'
