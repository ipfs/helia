import type { RPCServerConfig, Service } from '../../index.js'

export function createBlockstoreClose (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      await config.helia.blockstore.close()
    }
  }
}
