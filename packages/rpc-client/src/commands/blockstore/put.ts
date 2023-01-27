import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { PutOptions, PutRequest } from '@helia/rpc-protocol/blockstore'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'
import type { CID } from 'multiformats/cid'

export function createBlockstorePut (config: HeliaRpcMethodConfig): Helia['blockstore']['put'] {
  const put: Helia['blockstore']['put'] = async (cid: CID, block: Uint8Array, options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/blockstore/put',
      method: 'INVOKE',
      authorization: config.authorization,
      options: PutOptions.encode({
        ...options
      })
    }, RPCCallRequest)
    stream.writePB({
      cid: cid.bytes,
      block
    }, PutRequest)
    const response = await stream.readPB(RPCCallResponse)

    duplex.close()

    if (response.type === RPCCallResponseType.message) {
      return
    }

    throw new RPCError(response)
  }

  return put
}
