import { IdOptions, IdResponse } from '@helia/rpc-protocol/root'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { peerIdFromString } from '@libp2p/peer-id'
import { pbStream } from 'it-pb-stream'
import type { Duplex } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { RPCServerConfig, Service } from '../index.js'

export function createId (config: RPCServerConfig): Service {
  return {
    insecure: true,
    async handle (options: Uint8Array, stream: Duplex<Uint8Array | Uint8ArrayList>, signal: AbortSignal): Promise<void> {
      const opts = IdOptions.decode(options)
      const pb = pbStream(stream)
      const result = await config.helia.id({
        peerId: opts.peerId != null ? peerIdFromString(opts.peerId) : undefined,
        signal
      })

      pb.writePB({
        type: RPCCallResponseType.message,
        message: IdResponse.encode({
          ...result,
          peerId: result.peerId.toString(),
          serverDid: config.serverDid,
          multiaddrs: result.multiaddrs.map(ma => ma.toString())
        })
      }, RPCCallResponse)
    }
  }
}
