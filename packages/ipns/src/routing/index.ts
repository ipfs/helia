import type { DHTProgressEvents } from './dht.js'
import type { DatastoreProgressEvents } from './local-store.js'
import type { PubSubProgressEvents } from './pubsub.js'
import type { AbortOptions } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

export interface PutOptions extends AbortOptions, ProgressOptions {

}

export interface GetOptions extends AbortOptions, ProgressOptions {

}

export interface IPNSRouting {
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: GetOptions): Promise<Uint8Array>
}

export type IPNSRoutingEvents =
  DatastoreProgressEvents |
  DHTProgressEvents |
  PubSubProgressEvents

export { dht } from './dht.js'
export { pubsub } from './pubsub.js'
