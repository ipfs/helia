import { PutOptions, PutRequest, PutResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallMessage, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createBlockstorePut (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = PutOptions.decode(options)
      const request = await stream.readPB(PutRequest)
      const cid = CID.decode(request.cid)

      await config.helia.blockstore.put(cid, request.block, {
        signal,
        ...opts
      })

      stream.writePB({
        type: RPCCallMessageType.RPC_CALL_MESSAGE,
        message: PutResponse.encode({
        })
      },
      RPCCallMessage)
    }
  }
}
