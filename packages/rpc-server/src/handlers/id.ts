import { IdOptions, IdResponse } from '@helia/rpc-protocol/root'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { peerIdFromString } from '@libp2p/peer-id'
import type { RPCServerConfig, Service } from '../index.js'

export function createId (config: RPCServerConfig): Service {
  return {
    insecure: true,
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = IdOptions.decode(options)

      const result = await config.helia.id({
        peerId: opts.peerId != null ? peerIdFromString(opts.peerId) : undefined,
        signal
      })

      stream.writePB({
        type: RPCCallResponseType.message,
        message: IdResponse.encode({
          ...result,
          peerId: result.peerId.toString(),
          multiaddrs: result.multiaddrs.map(ma => ma.toString())
        })
      }, RPCCallResponse)
    }
  }
}
