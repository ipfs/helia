import { InfoOptions, InfoResponse } from '@helia/rpc-protocol/root'
import { RPCCallMessage, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import { peerIdFromString } from '@libp2p/peer-id'
import type { RPCServerConfig, Service } from '../index.js'

export function createInfo (config: RPCServerConfig): Service {
  return {
    insecure: true,
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = InfoOptions.decode(options)

      const result = await config.helia.info({
        peerId: opts.peerId != null ? peerIdFromString(opts.peerId) : undefined,
        signal
      })

      stream.writePB({
        type: RPCCallMessageType.RPC_CALL_MESSAGE,
        message: InfoResponse.encode({
          ...result,
          peerId: result.peerId.toString(),
          multiaddrs: result.multiaddrs.map(ma => ma.toString())
        })
      }, RPCCallMessage)
    }
  }
}
