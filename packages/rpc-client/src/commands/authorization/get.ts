import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { GetOptions, GetRequest, GetResponse } from '@helia/rpc-protocol/authorization'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { HeliaRpcClientConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'

export function createAuthorizationGet (config: HeliaRpcClientConfig): (user: string, options?: any) => Promise<string> {
  const get = async (user: string, options = {}): Promise<string> => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    if (config.libp2p.peerId.publicKey == null || config.libp2p.peerId.privateKey == null) {
      throw new Error('Public key component missing')
    }

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/authorization/get',
      method: 'INVOKE',
      options: GetOptions.encode({
        ...options
      })
    }, RPCCallRequest)
    stream.writePB({
      user
    }, GetRequest)
    const response = await stream.readPB(RPCCallResponse)

    duplex.close()

    if (response.type === RPCCallResponseType.message) {
      if (response.message == null) {
        throw new TypeError('RPC response had message type but no message')
      }

      const message = GetResponse.decode(response.message)

      return message.authorization
    }

    throw new RPCError(response)
  }

  return get
}
