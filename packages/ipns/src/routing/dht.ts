import { logger } from '@libp2p/logger'
import type { IPNSRouting } from '../index.js'
import type { DHT, QueryEvent } from '@libp2p/interface-dht'
import type { GetOptions, PutOptions } from './index.js'
import { CustomProgressEvent, ProgressEvent } from 'progress-events'

const log = logger('helia:ipns:routing:dht')

export interface DHTRoutingComponents {
  libp2p: {
    dht: DHT
  }
}

export type DHTProgressEvents =
  ProgressEvent<'ipns:routing:dht:query', QueryEvent> |
  ProgressEvent<'ipns:routing:dht:error', Error>

export class DHTRouting implements IPNSRouting {
  private readonly dht: DHT

  constructor (components: DHTRoutingComponents) {
    this.dht = components.libp2p.dht
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options: PutOptions = {}): Promise<void> {
    let putValue = false

    try {
      for await (const event of this.dht.put(routingKey, marshaledRecord, options)) {
        logEvent('DHT put event', event)

        options.onProgress?.(new CustomProgressEvent<QueryEvent>('ipns:routing:dht:query', event))

        if (event.name === 'PEER_RESPONSE' && event.messageName === 'PUT_VALUE') {
          putValue = true
        }
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:dht:error', err))
    }

    if (!putValue) {
      throw new Error('Could not put value to DHT')
    }
  }

  async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
    try {
      for await (const event of this.dht.get(routingKey, options)) {
        logEvent('DHT get event', event)

        options.onProgress?.(new CustomProgressEvent<QueryEvent>('ipns:routing:dht:query', event))

        if (event.name === 'VALUE') {
          return event.value
        }
      }
    } catch (err: any) {
      options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:dht:error', err))
    }

    throw new Error('Not found')
  }
}

function logEvent (prefix: string, event: QueryEvent): void {
  if (event.name === 'SENDING_QUERY') {
    log(prefix, event.name, event.messageName, '->', event.to.toString())
  } else if (event.name === 'PEER_RESPONSE') {
    log(prefix, event.name, event.messageName, '<-', event.from.toString())
  } else if (event.name === 'FINAL_PEER') {
    log(prefix, event.name, event.peer.id.toString())
  } else if (event.name === 'QUERY_ERROR') {
    log(prefix, event.name, event.error.message)
  } else if (event.name === 'PROVIDER') {
    log(prefix, event.name, event.providers.map(p => p.id.toString()).join(', '))
  } else {
    log(prefix, event.name)
  }
}

export function dht (components: DHTRoutingComponents): IPNSRouting {
  return new DHTRouting(components)
}
