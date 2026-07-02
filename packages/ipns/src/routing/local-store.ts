import type { LocalStore } from '../local-store.ts'
import type { IPNSRouting, IPNSRoutingPutOptions, IPNSRoutingGetOptions } from './index.ts'

class LocalStoreIPNSRouting {
  private localStore: LocalStore

  constructor (localStore: LocalStore) {
    this.localStore = localStore
  }

  async put (routingKey: Uint8Array, marshaledRecord: Uint8Array, options?: IPNSRoutingPutOptions): Promise<void> {
    await this.localStore.put(routingKey, marshaledRecord, options)
  }

  async get (routingKey: Uint8Array, options?: IPNSRoutingGetOptions): Promise<Uint8Array<ArrayBuffer>> {
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
export function localStoreIPNSRouting (localStore: LocalStore): IPNSRouting {
  return new LocalStoreIPNSRouting(localStore)
}
