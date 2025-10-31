import { Record } from '@libp2p/kad-dht'
import { CustomProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { IPNSPublishMetadata } from './pb/metadata.js'
import { dhtRoutingKey, DHT_RECORD_PREFIX, ipnsMetadataKey } from './utils.js'
import type { DatastoreProgressEvents, GetOptions, PutOptions } from './routing/index.js'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'

export interface GetResult {
  record: Uint8Array
  created: Date
}

export interface ListResult {
  routingKey: Uint8Array
  record: Uint8Array
  created: Date
  metadata?: IPNSPublishMetadata
}

export interface ListOptions extends AbortOptions {
  onProgress?(evt: DatastoreProgressEvents): void
}

export interface LocalStore {
  /**
   * Put an IPNS record into the datastore
   *
   * @param routingKey - The routing key for the IPNS record
   * @param marshaledRecord - The marshaled IPNS record
   * @param options - options for the put operation including metadata
   */
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: GetOptions): Promise<GetResult>
  has(routingKey: Uint8Array, options?: AbortOptions): Promise<boolean>
  delete(routingKey: Uint8Array, options?: AbortOptions): Promise<void>
  /**
   * List all IPNS records in the datastore
   */
  list(options?: ListOptions): AsyncIterable<ListResult>
}

/**
 * Read/write IPNS records to the datastore as DHT records.
 *
 * This lets us publish IPNS records offline then serve them to the network
 * later in response to DHT queries.
 */
export function localStore (datastore: Datastore, log: Logger): LocalStore {
  return {
    async put (routingKey: Uint8Array, marshalledRecord: Uint8Array, options: PutOptions = {}) {
      try {
        const key = dhtRoutingKey(routingKey)

        if (options.overwrite !== true) {
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
        }

        // Marshal to libp2p record as the DHT does
        const record = new Record(routingKey, marshalledRecord, new Date())

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:put'))
        const batch = datastore.batch()
        batch.put(key, record.serialize())

        if (options.metadata != null) {
          // derive the datastore key for the IPNS metadata from the same routing key
          batch.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode(options.metadata))
        }
        await batch.commit(options)
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
      const batch = datastore.batch()
      batch.delete(key)
      batch.delete(ipnsMetadataKey(routingKey))
      await batch.commit(options)
    },
    async * list (options: ListOptions = {}): AsyncIterable<ListResult> {
      try {
        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:list'))

        // Query all records with the DHT_RECORD_PREFIX
        for await (const { key, value } of datastore.query({
          prefix: DHT_RECORD_PREFIX
        }, options)) {
          try {
            // Deserialize the record
            const libp2pRecord = Record.deserialize(value)

            // Extract the routing key from the datastore key
            const keyString = key.toString()
            const routingKeyBase32 = keyString.substring(DHT_RECORD_PREFIX.length)
            const routingKey = uint8ArrayFromString(routingKeyBase32, 'base32')

            const metadataKey = ipnsMetadataKey(routingKey)
            let metadata: IPNSPublishMetadata | undefined
            try {
              const metadataBuf = await datastore.get(metadataKey, options)
              metadata = IPNSPublishMetadata.decode(metadataBuf)
            } catch (err: any) {
              log.error('Error deserializing metadata for %s - %e', routingKeyBase32, err)
            }

            yield {
              routingKey,
              metadata,
              record: libp2pRecord.value,
              created: libp2pRecord.timeReceived
            }
          } catch (err) {
            // Skip invalid records
            log.error('Error deserializing record - %e', err)
          }
        }
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    }
  }
}
