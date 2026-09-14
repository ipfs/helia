import type { HeliaRoutingProgressEvents } from './helia.ts'
import type { DatastoreProgressEvents } from '../index.ts'
import type { PubSubProgressEvents } from './pubsub.ts'
import type { IPNSPublishMetadata } from '../pb/metadata.ts'
import type { AbortOptions } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

export interface IPNSRoutingPutOptions extends AbortOptions, ProgressOptions {
  metadata?: Partial<IPNSPublishMetadata>

  /**
   * Overwrite an identical stored record instead of keeping the existing one,
   * re-stamping its local timestamp. Passed on republish/rebroadcast so the
   * record is not re-selected for republishing every cycle.
   */
  overwrite?: boolean
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

/**
 * Return a printable name for a router, falling back to `CustomRouting()` when
 * the router does not set its own `toString`.
 */
export function routerName (router: IPNSRouting): string {
  if (router.toString === Object.prototype.toString) {
    return 'CustomRouting()'
  }

  const name = router.toString()

  if (typeof name !== 'string' || name === '') {
    return 'CustomRouting()'
  }

  return name
}

export function isLocalStoreRouting (router: IPNSRouting): boolean {
  return String(router) === 'LocalStoreRouting()'
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
