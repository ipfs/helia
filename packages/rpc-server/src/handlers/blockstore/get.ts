import { GetOptions, GetRequest, GetResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createGet (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = GetOptions.decode(options)
      const request = await stream.readPB(GetRequest)
      const cid = CID.decode(request.cid)

      const block = await config.helia.blockstore.get(cid, {
        signal,
        ...opts
      })

      stream.writePB({
        type: RPCCallResponseType.message,
        message: GetResponse.encode({
          block
        })
      },
      RPCCallResponse)
    }
  }
}
