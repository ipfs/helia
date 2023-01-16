import { DeleteRequest, DeleteResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { Duplex } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'
import { pbStream } from 'it-pb-stream'

export function createDelete (config: RPCServerConfig): Service {
  return {
    async handle (options: Uint8Array, stream: Duplex<Uint8Array | Uint8ArrayList>, signal: AbortSignal): Promise<void> {
      // const opts = DeleteOptions.decode(options)
      const pb = pbStream(stream)
      const request = await pb.readPB(DeleteRequest)
      const cid = CID.decode(request.cid)

      await config.helia.blockstore.delete(cid, {
        signal
      })

      pb.writePB({
        type: RPCCallResponseType.message,
        message: DeleteResponse.encode({
        })
      },
      RPCCallResponse)
    }
  }
}
