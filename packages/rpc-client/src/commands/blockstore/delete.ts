import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { DeleteOptions, DeleteRequest } from '@helia/rpc-protocol/blockstore'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'
import type { CID } from 'multiformats/cid'

export function createBlockstoreDelete (config: HeliaRpcMethodConfig): Helia['blockstore']['delete'] {
  const del: Helia['blockstore']['delete'] = async (cid: CID, options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/blockstore/delete',
      method: 'INVOKE',
      authorization: config.authorization,
      options: DeleteOptions.encode({
        ...options
      })
    }, RPCCallRequest)
    stream.writePB({
      cid: cid.bytes
    }, DeleteRequest)
    const response = await stream.readPB(RPCCallResponse)

    duplex.close()

    if (response.type === RPCCallResponseType.message) {
      return
    }

    throw new RPCError(response)
  }

  return del
}
