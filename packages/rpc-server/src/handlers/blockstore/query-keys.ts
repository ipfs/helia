import { QueryKeysOptions, QueryKeysResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallMessage, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'

export function createBlockstoreQueryKeys (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = QueryKeysOptions.decode(options)

      for await (const cid of config.helia.blockstore.queryKeys({
        ...opts
      }, {
        signal
      })) {
        stream.writePB({
          type: RPCCallMessageType.RPC_CALL_MESSAGE,
          message: QueryKeysResponse.encode({
            key: cid.bytes
          })
        },
        RPCCallMessage)
      }
    }
  }
}
