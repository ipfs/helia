import { IdOptions, IdResponse } from '@helia/rpc-protocol/root'
import { RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { peerIdFromString } from '@libp2p/peer-id'
import type { Source } from 'it-stream-types'
import type { Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import type { RPCServerConfig, Service } from '../index.js'

export function createId (config: RPCServerConfig): Service {
  return {
    insecure: true,
    async handle (options: Uint8Array, input: Source<Uint8Array | Uint8ArrayList>, output: Pushable<Uint8Array | Uint8ArrayList>, signal: AbortSignal): Promise<void> {
      const opts = IdOptions.decode(options)

      const result = await config.helia.id({
        peerId: opts.peerId != null ? peerIdFromString(opts.peerId) : undefined,
        signal
      })

      output.push(
        RPCCallResponse.encode({
          type: RPCCallResponseType.message,
          message: IdResponse.encode({
            ...result,
            peerId: result.peerId.toString(),
            serverDid: config.serverDid,
            multiaddrs: result.multiaddrs.map(ma => ma.toString())
          })
        })
      )
    }
  }
}
