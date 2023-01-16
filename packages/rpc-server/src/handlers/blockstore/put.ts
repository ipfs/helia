import { PutRequest, PutResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { Duplex } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'
import { pbStream } from 'it-pb-stream'

export function createPut (config: RPCServerConfig): Service {
  return {
    async handle (options: Uint8Array, stream: Duplex<Uint8Array | Uint8ArrayList>, signal: AbortSignal): Promise<void> {
      // const opts = HasOptions.decode(options)
      const pb = pbStream(stream)
      const request = await pb.readPB(PutRequest)
      const cid = CID.decode(request.cid)

      await config.helia.blockstore.put(cid, request.block, {
        signal
      })

      pb.writePB({
        type: RPCCallResponseType.message,
        message: PutResponse.encode({
        })
      },
      RPCCallResponse)
    }
  }
}
