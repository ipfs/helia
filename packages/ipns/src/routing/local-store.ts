import { Libp2pRecord } from '@libp2p/record'
import { type Datastore, Key } from 'interface-datastore'
import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { GetOptions, IPNSRouting, PutOptions } from '../routing'
import type { AbortOptions } from '@libp2p/interfaces'

function dhtRoutingKey (key: Uint8Array): Key {
  return new Key('/dht/record/' + uint8ArrayToString(key, 'base32'), false)
}

export type DatastoreProgressEvents =
  ProgressEvent<'ipns:routing:datastore:put'> |
  ProgressEvent<'ipns:routing:datastore:get'> |
  ProgressEvent<'ipns:routing:datastore:error', Error>

export interface LocalStore extends IPNSRouting {
  has: (routingKey: Uint8Array, options?: AbortOptions) => Promise<boolean>
}

/**
 * Returns an IPNSRouting implementation that reads/writes IPNS records to the
 * datastore as DHT records. This lets us publish IPNS records offline then
 * serve them to the network later in response to DHT queries.
 */
export function localStore (datastore: Datastore): LocalStore {
  return {
    async put (routingKey: Uint8Array, marshalledRecord: Uint8Array, options: PutOptions = {}) {
      try {
        const key = dhtRoutingKey(routingKey)

        // Marshal to libp2p record as the DHT does
        const record = new Libp2pRecord(routingKey, marshalledRecord, new Date())

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:put'))
        await datastore.put(key, record.serialize(), options)
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    },
    async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<Uint8Array> {
      try {
        const key = dhtRoutingKey(routingKey)

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:get'))
        const buf = await datastore.get(key, options)

        // Unmarshal libp2p record as the DHT does
        const record = Libp2pRecord.deserialize(buf)

        return record.value
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    },
    async has (routingKey: Uint8Array, options: AbortOptions = {}): Promise<boolean> {
      const key = dhtRoutingKey(routingKey)
      return datastore.has(key, options)
    }
  }
}
