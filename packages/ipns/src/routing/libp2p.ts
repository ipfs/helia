import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import type { GetOptions, PutOptions } from './index.js'
import type { IPNSRouting } from '../index.js'
import type { ContentRouting } from '@libp2p/interface'

export interface Libp2pContentRoutingComponents {
  libp2p: {
    contentRouting: ContentRouting
  }
}

export type Libp2pContentRoutingProgressEvents =
  ProgressEvent<'ipns:routing:libp2p:error', Error>

export class Libp2pContentRouting implements IPNSRouting {
  private readonly contentRouting: ContentRouting

  constructor (components: Libp2pContentRoutingComponents) {
    this.contentRouting = components.libp2p.contentRouting
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    try {
      await this.contentRouting.put(routingKey, marshaledRecord, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:libp2p:error', err))
    }
  }

  async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
    try {
      return await this.contentRouting.get(routingKey, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:libp2p:error', err))
    }

    throw new Error('Not found')
  }
}

/**
 * The libp2p routing uses any available Content Routers configured on the
 * passed libp2p node. This could be KadDHT, HTTP API Delegated Routing, etc.
 */
export function libp2p (components: Libp2pContentRoutingComponents): IPNSRouting {
  return new Libp2pContentRouting(components)
}
