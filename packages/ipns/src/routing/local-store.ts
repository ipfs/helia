import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting, PutOptions, GetOptions } from './index.ts'

class LocalStoreRouting {
  private localStore: LocalStore

  constructor (localStore: LocalStore) {
    this.localStore = localStore
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: PutOptions): Promise<void> {
    await this.localStore.put(routingKey, marshaledRecord, options)
  }

  async get (routingKey: Uint8Array, options?: GetOptions): Promise<Uint8Array> {
    const { record } = await this.localStore.get(routingKey, options)

    return record
  }

  toString (): string {
    return 'LocalStoreRouting()'
  }
}

/**
 * Returns an IPNSRouting implementation that reads/writes to the local store
 */
export function localStoreRouting (localStore: LocalStore): IPNSRouting {
  return new LocalStoreRouting(localStore)
}
