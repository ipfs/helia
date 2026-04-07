/**
 * @packageDocumentation
 *
 * Abstraction layer over different content and peer routing mechanisms.
 */
export { delegatedHTTPRouting } from './delegated-http-routing.ts'
export { delegatedHTTPRoutingDefaults } from './utils/delegated-http-routing-defaults.ts'
export { httpGatewayRouting } from './http-gateway-routing.ts'
export type { HTTPGatewayRouterInit } from './http-gateway-routing.ts'
export { libp2pRouting } from './libp2p-routing.ts'
