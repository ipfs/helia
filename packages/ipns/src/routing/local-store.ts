import { Record } from '@libp2p/kad-dht'
import { type Datastore, Key } from 'interface-datastore'
import { CustomProgressEvent, type ProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { GetOptions, PutOptions } from '../routing'
import type { AbortOptions } from '@libp2p/interface'

function dhtRoutingKey (key: Uint8Array): Key {
  return new Key('/dht/record/' + uint8ArrayToString(key, 'base32'), false)
}

export type DatastoreProgressEvents =
  ProgressEvent<'ipns:routing:datastore:put'> |
  ProgressEvent<'ipns:routing:datastore:get'> |
  ProgressEvent<'ipns:routing:datastore:error', Error>

export interface GetResult {
  record: Uint8Array
  created: Date
}

export interface LocalStore {
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: GetOptions): Promise<GetResult>
  has(routingKey: Uint8Array, options?: AbortOptions): Promise<boolean>
  delete(routingKey: Uint8Array, options?: AbortOptions): Promise<void>
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

        // don't overwrite existing, identical records as this will affect the
        // TTL
        try {
          const existingBuf = await datastore.get(key)
          const existingRecord = Record.deserialize(existingBuf)

          if (uint8ArrayEquals(existingRecord.value, marshalledRecord)) {
            return
          }
        } catch (err: any) {
          if (err.name !== 'NotFoundError') {
            throw err
          }
        }

        // Marshal to libp2p record as the DHT does
        const record = new Record(routingKey, marshalledRecord, new Date())

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:put'))
        await datastore.put(key, record.serialize(), options)
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    },
    async get (routingKey: Uint8Array, options: GetOptions = {}): Promise<GetResult> {
      try {
        const key = dhtRoutingKey(routingKey)

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:get'))
        const buf = await datastore.get(key, options)

        // Unmarshal libp2p record as the DHT does
        const record = Record.deserialize(buf)

        return {
          record: record.value,
          created: record.timeReceived
        }
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    },
    async has (routingKey: Uint8Array, options: AbortOptions = {}): Promise<boolean> {
      const key = dhtRoutingKey(routingKey)
      return datastore.has(key, options)
    },
    async delete (routingKey, options): Promise<void> {
      const key = dhtRoutingKey(routingKey)
      return datastore.delete(key, options)
    }
  }
}
