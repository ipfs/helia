import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import type { GetOptions, PutOptions } from './index.js'
import type { IPNSRouting } from '../index.js'
import type { Routing } from '@helia/interface'

export interface HeliaRoutingComponents {
  routing: Routing
}

export type HeliaRoutingProgressEvents =
  ProgressEvent<'ipns:routing:helia:error', Error>

export class HeliaRouting implements IPNSRouting {
  private readonly routing: Routing

  constructor (routing: Routing) {
    this.routing = routing
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    try {
      await this.routing.put(routingKey, marshaledRecord, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:helia:error', err))
    }
  }

  async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
    try {
      return await this.routing.get(routingKey, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:helia:error', err))
    }

    throw new Error('Not found')
  }
}

/**
 * The helia routing uses any available Routers configured on the passed Helia
 * node. This could be libp2p, HTTP API Delegated Routing, etc.
 */
export function helia (routing: Routing): IPNSRouting {
  return new HeliaRouting(routing)
}
