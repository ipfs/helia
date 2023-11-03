import { TrustlessGatewayBlockBroker } from './broker.js'
import type { BlockRetriever } from '@helia/interface/src/blocks.js'
import type { ProgressEvent } from 'progress-events'

export const DEFAULT_TRUSTLESS_GATEWAYS = [
  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://dweb.link',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://cf-ipfs.com',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://4everland.io',

  // 2023-10-03: IPNS, Origin, and Block/CAR support from https://ipfs-public-gateway-checker.on.fleek.co/
  'https://w3s.link'
]

export type TrustlessGatewayGetBlockProgressEvents =
  ProgressEvent<'trustless-gateway:get-block:fetch', URL>

export interface TrustlessGatewayBlockBrokerInit {
  gateways?: Array<string | URL>
}

export function trustlessGateway (init: TrustlessGatewayBlockBrokerInit = {}): () => BlockRetriever {
  return () => new TrustlessGatewayBlockBroker(init)
}
