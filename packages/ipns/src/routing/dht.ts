import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import type { GetOptions, PutOptions } from './index.js'
import type { IPNSRouting } from '../index.js'
import type { ContentRouting } from '@libp2p/interface-content-routing'

export interface DHTRoutingComponents {
  libp2p: {
    contentRouting: ContentRouting
  }
}

export type DHTProgressEvents =
  ProgressEvent<'ipns:routing:dht:error', Error>

export class DHTRouting implements IPNSRouting {
  private readonly contentRouting: ContentRouting

  constructor (components: DHTRoutingComponents) {
    this.contentRouting = components.libp2p.contentRouting
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    try {
      await this.contentRouting.put(routingKey, marshaledRecord, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:dht:error', err))
    }
  }

  async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
    try {
      return await this.contentRouting.get(routingKey, options)
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:dht:error', err))
    }

    throw new Error('Not found')
  }
}

export function dht (components: DHTRoutingComponents): IPNSRouting {
  return new DHTRouting(components)
}
