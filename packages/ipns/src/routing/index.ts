import type { HeliaRoutingProgressEvents } from './helia.js'
import type { DatastoreProgressEvents } from './local-store.js'
import type { PubSubProgressEvents } from './pubsub.js'
import type { AbortOptions } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

export interface PutOptions extends AbortOptions, ProgressOptions {

}

export interface GetOptions extends AbortOptions, ProgressOptions {
  /**
   * Pass false to not perform validation actions
   *
   * @default true
   */
  validate?: boolean
}

export interface IPNSRouting {
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: GetOptions): Promise<Uint8Array>
}

export type { DatastoreProgressEvents }
export type { HeliaRoutingProgressEvents }
export type { PubSubProgressEvents }

export type IPNSRoutingEvents =
  DatastoreProgressEvents |
  HeliaRoutingProgressEvents |
  PubSubProgressEvents

export { helia } from './helia.js'
export { pubsub } from './pubsub.js'
export type { PubsubRoutingComponents } from './pubsub.js'
