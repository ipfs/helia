import { DeleteOptions, DeleteRequest, DeleteResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createDelete (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = DeleteOptions.decode(options)
      const request = await stream.readPB(DeleteRequest)
      const cid = CID.decode(request.cid)

      await config.helia.blockstore.delete(cid, {
        signal,
        ...opts
      })

      stream.writePB({
        type: RPCCallResponseType.message,
        message: DeleteResponse.encode({
        })
      },
      RPCCallResponse)
    }
  }
}
