import { multiaddr } from '@multiformats/multiaddr'
import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { InfoOptions, InfoResponse } from '@helia/rpc-protocol/root'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import type { HeliaRpcMethodConfig } from '../index.js'
import { pbStream } from 'it-pb-stream'

export function createInfo (config: HeliaRpcMethodConfig): Helia['info'] {
  const info: Helia['info'] = async (options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/info',
      method: 'INVOKE',
      options: InfoOptions.encode({
        ...options,
        peerId: options.peerId != null ? options.peerId.toString() : undefined
      })
    }, RPCCallRequest)
    const response = await stream.readPB(RPCCallResponse)

    duplex.close()

    if (response.type === RPCCallResponseType.message) {
      if (response.message == null) {
        throw new TypeError('RPC response had message type but no message')
      }

      const infoResponse = InfoResponse.decode(response.message)

      return {
        ...infoResponse,
        peerId: peerIdFromString(infoResponse.peerId),
        multiaddrs: infoResponse.multiaddrs.map(str => multiaddr(str))
      }
    }

    throw new RPCError(response)
  }

  return info
}
