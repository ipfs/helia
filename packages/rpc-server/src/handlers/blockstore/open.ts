import type { RPCServerConfig, Service } from '../../index.js'

export function createBlockstoreOpen (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      await config.helia.blockstore.open()
    }
  }
}
