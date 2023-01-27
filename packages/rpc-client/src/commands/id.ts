import { multiaddr } from '@multiformats/multiaddr'
import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { IdOptions, IdResponse } from '@helia/rpc-protocol/root'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import type { HeliaRpcMethodConfig } from '../index.js'
import { pbStream } from 'it-pb-stream'

export function createId (config: HeliaRpcMethodConfig): Helia['id'] {
  const id: Helia['id'] = async (options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/id',
      method: 'INVOKE',
      options: IdOptions.encode({
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

      const idResponse = IdResponse.decode(response.message)

      return {
        ...idResponse,
        peerId: peerIdFromString(idResponse.peerId),
        multiaddrs: idResponse.multiaddrs.map(str => multiaddr(str))
      }
    }

    throw new RPCError(response)
  }

  return id
}
