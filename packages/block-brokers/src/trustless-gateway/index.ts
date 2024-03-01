import { TrustlessGatewayBlockBroker } from './broker.js'
import type { Routing, BlockBroker } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { ProgressEvent } from 'progress-events'

export const DEFAULT_TRUSTLESS_GATEWAYS = [
  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://trustless-gateway.link',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://cloudflare-ipfs.com',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://4everland.io'
]

export type TrustlessGatewayGetBlockProgressEvents =
  ProgressEvent<'trustless-gateway:get-block:fetch', URL>

export interface TrustlessGatewayBlockBrokerInit {
  gateways?: Array<string | URL>
}

export interface TrustlessGatewayComponents {
  routing: Routing
  logger: ComponentLogger
}

export function trustlessGateway (init: TrustlessGatewayBlockBrokerInit = {}): (components: TrustlessGatewayComponents) => BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  return (components) => new TrustlessGatewayBlockBroker(components, init)
}
