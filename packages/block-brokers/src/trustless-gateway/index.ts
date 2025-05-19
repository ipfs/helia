import { TrustlessGatewayBlockBroker } from './broker.js'
import type { TransformRequestInit } from './trustless-gateway.js'
import type { Routing, BlockBroker } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { ProgressEvent } from 'progress-events'

export const DEFAULT_ALLOW_INSECURE = false
export const DEFAULT_ALLOW_LOCAL = false
/**
 * The maximum number of bytes to allow when fetching a raw block.
 *
 * @see https://specs.ipfs.tech/bitswap-protocol/#block-sizes
 */
export const DEFAULT_MAX_SIZE = 2_097_152

export type TrustlessGatewayGetBlockProgressEvents =
  ProgressEvent<'trustless-gateway:get-block:fetch', URL>

export interface TrustlessGatewayBlockBrokerInit {
  /**
   * By default we will only connect to peers with HTTPS addresses, pass true
   * to also connect to HTTP addresses.
   *
   * @default false
   */
  allowInsecure?: boolean

  /**
   * By default we will only connect to peers with public or DNS addresses, pass
   * true to also connect to private addresses.
   *
   * @default false
   */
  allowLocal?: boolean
  /**
   * Provide a function that will be called before querying trustless-gateways. This lets you modify the fetch options to pass custom headers or other necessary things.
   */
  transformRequestInit?: TransformRequestInit
}

export interface TrustlessGatewayBlockBrokerComponents {
  routing: Routing
  logger: ComponentLogger
}

export function trustlessGateway (init: TrustlessGatewayBlockBrokerInit = {}): (components: TrustlessGatewayBlockBrokerComponents) => BlockBroker<TrustlessGatewayGetBlockProgressEvents> {
  return (components) => new TrustlessGatewayBlockBroker(components, init)
}
