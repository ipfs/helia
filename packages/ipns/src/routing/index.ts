import type { HeliaRoutingProgressEvents } from './helia.ts'
import type { DatastoreProgressEvents } from '../index.ts'
import type { PubSubProgressEvents } from './pubsub.ts'
import type { IPNSPublishMetadata } from '../pb/metadata.ts'
import type { AbortOptions } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

export interface IPNSRoutingPutOptions extends AbortOptions, ProgressOptions {
  metadata?: IPNSPublishMetadata
}

export interface IPNSRoutingGetOptions extends AbortOptions, ProgressOptions {
  /**
   * Pass false to not perform validation actions
   *
   * @default true
   */
  validate?: boolean
}

export interface IPNSRouting {
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: IPNSRoutingPutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: IPNSRoutingGetOptions): Promise<Uint8Array>
}

export type { DatastoreProgressEvents }
export type { HeliaRoutingProgressEvents }
export type { PubSubProgressEvents }

export type IPNSRoutingProgressEvents =
  DatastoreProgressEvents |
  HeliaRoutingProgressEvents |
  PubSubProgressEvents

export { heliaIPNSRouting } from './helia.ts'
export { pubSubIPNSRouting } from './pubsub.ts'
export type { PubsubRoutingComponents, PubSub, PubSubMessage, PublishResult, PubSubEvents, PubSubSubscription, PubSubSubscriptionChangeData } from './pubsub.ts'
