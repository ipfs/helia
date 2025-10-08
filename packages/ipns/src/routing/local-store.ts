import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting, PutOptions, GetOptions } from './index.ts'

/**
 * Returns an IPNSRouting implementation that reads/writes to the local store
 */
export function localStoreRouting (localStore: LocalStore): IPNSRouting {
  return {
    async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void> {
      await localStore.put(routingKey, marshaledRecord, options)
    },
    async get (routingKey: Uint8Array, options?: GetOptions): Promise<Uint8Array> {
      const { record } = await localStore.get(routingKey, options)

      return record
    }
  }
}
