import { Record } from '@libp2p/kad-dht'
import { CustomProgressEvent } from 'progress-events'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { withArrayBuffer } from 'uint8arrays/with-array-buffer'
import { IPNSPublishMetadata, Upkeep } from './pb/metadata.ts'
import { dhtRoutingKey, DHT_RECORD_PREFIX, ipnsMetadataKey } from './utils.ts'
import type { DatastoreProgressEvents, IPNSRoutingGetOptions, IPNSRoutingPutOptions } from './routing/index.ts'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'

export interface GetResult {
  record: Uint8Array<ArrayBuffer>
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
  put(routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: IPNSRoutingPutOptions): Promise<void>
  get(routingKey: Uint8Array, options?: IPNSRoutingGetOptions): Promise<GetResult>
  has(routingKey: Uint8Array, options?: AbortOptions): Promise<boolean>
  delete(routingKey: Uint8Array, options?: AbortOptions): Promise<void>
  /**
   * Delete only the IPNS metadata for a record, leaving the record itself in
   * place so it is still served but no longer automatically republished
   */
  deleteMetadata(routingKey: Uint8Array, options?: AbortOptions): Promise<void>
  /**
   * List all IPNS records in the datastore
   */
  list(options?: ListOptions): AsyncIterable<ListResult>
}

/**
 * Merge a (possibly partial) metadata update into any metadata already stored
 * for the routing key, so fields that are not being changed are preserved.
 *
 * Throws if the existing metadata cannot be read (rather than silently
 * overwriting it and dropping keyName/lifetime), or if the resulting policy
 * needs a keyName it does not have.
 */
async function mergeMetadata (datastore: Datastore, routingKey: Uint8Array, incoming: Partial<IPNSPublishMetadata>, options?: AbortOptions): Promise<Partial<IPNSPublishMetadata>> {
  let metadata = incoming

  try {
    // merge into any existing metadata so a partial update (e.g. republish
    // setting only `upkeep`) preserves keyName/lifetime instead of wiping them
    const existing = IPNSPublishMetadata.decode(await datastore.get(ipnsMetadataKey(routingKey), options))
    metadata = { ...existing, ...incoming }
  } catch (err: any) {
    if (err.name !== 'NotFoundError') {
      // the stored metadata is unreadable, surface it rather than silently
      // overwriting and dropping keyName/lifetime
      throw err
    }
  }

  // the reissue upkeep policy re-signs the record, which needs the key, so
  // refuse to persist that policy without a keyName
  if (metadata.upkeep === Upkeep.reissue && (metadata.keyName == null || metadata.keyName === '')) {
    throw new Error('a keyName is required to reissue a record')
  }

  return metadata
}

/**
 * Read the stored upkeep metadata for a routing key, if any. A record with no
 * metadata is normal (imported, or unpublished), so that is not an error; only
 * an actual decode/corruption failure is logged.
 */
async function readMetadata (datastore: Datastore, routingKey: Uint8Array, log: Logger, options?: AbortOptions): Promise<IPNSPublishMetadata | undefined> {
  try {
    return IPNSPublishMetadata.decode(await datastore.get(ipnsMetadataKey(routingKey), options))
  } catch (err: any) {
    if (err.name !== 'NotFoundError') {
      log.error('error deserializing metadata for %b - %e', routingKey, err)
    }

    return undefined
  }
}

/**
 * Read/write IPNS records to the datastore as DHT records.
 *
 * This lets us publish IPNS records offline then serve them to the network
 * later in response to DHT queries.
 */
export function localStore (datastore: Datastore, log: Logger): LocalStore {
  return {
    async put (routingKey: Uint8Array, marshalledRecord: Uint8Array, options: IPNSRoutingPutOptions = {}) {
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
          // merge into any existing metadata (preserving keyName/lifetime on a
          // partial update) and validate the result before writing it
          const metadata = await mergeMetadata(datastore, routingKey, options.metadata, options)
          batch.put(ipnsMetadataKey(routingKey), IPNSPublishMetadata.encode(metadata))
        }
        await batch.commit(options)
      } catch (err: any) {
        options.onProgress?.(new CustomProgressEvent<Error>('ipns:routing:datastore:error', err))
        throw err
      }
    },
    async get (routingKey: Uint8Array, options: IPNSRoutingGetOptions = {}): Promise<GetResult> {
      try {
        const key = dhtRoutingKey(routingKey)

        options.onProgress?.(new CustomProgressEvent('ipns:routing:datastore:get'))
        const buf = await datastore.get(key, options)

        // Unmarshal libp2p record as the DHT does
        const record = Record.deserialize(buf)

        return {
          record: withArrayBuffer(record.value),
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
    async deleteMetadata (routingKey, options): Promise<void> {
      await datastore.delete(ipnsMetadataKey(routingKey), options)
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

            const metadata = await readMetadata(datastore, routingKey, log, options)

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
