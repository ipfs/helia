/**
 * @packageDocumentation
 *
 * Abstraction layer over different content and peer routing mechanisms.
 */
export { delegatedHTTPRouting } from './delegated-http-routing.js'
export { delegatedHTTPRoutingDefaults } from './utils/delegated-http-routing-defaults.js'
export { httpGatewayRouting } from './http-gateway-routing.js'
export type { HTTPGatewayRouterInit } from './http-gateway-routing.js'
export { libp2pRouting } from './libp2p-routing.js'
