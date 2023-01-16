import { GetRequest, GetResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import type { Duplex } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'
import { pbStream } from 'it-pb-stream'

export function createGet (config: RPCServerConfig): Service {
  return {
    async handle (options: Uint8Array, stream: Duplex<Uint8Array | Uint8ArrayList>, signal: AbortSignal): Promise<void> {
      // const opts = GetOptions.decode(options)
      const pb = pbStream(stream)
      const request = await pb.readPB(GetRequest)
      const cid = CID.decode(request.cid)

      const block = await config.helia.blockstore.get(cid, {
        signal
      })

      pb.writePB({
        type: RPCCallResponseType.message,
        message: GetResponse.encode({
          block
        })
      },
      RPCCallResponse)
    }
  }
}
