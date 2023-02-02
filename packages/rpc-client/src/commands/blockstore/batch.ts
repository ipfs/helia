import { BatchOptions, BatchRequest, BatchRequestDelete, BatchRequestPut, BatchRequestType } from '@helia/rpc-protocol/blockstore'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import type { CID } from 'multiformats/cid'
import { RPCCallMessage, RPCCallRequest, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import { HELIA_RPC_PROTOCOL } from '@helia/rpc-protocol'
import { pbStream } from 'it-pb-stream'
import type { Pair, Batch } from 'interface-blockstore'

export function createBlockstoreBatch (config: HeliaRpcMethodConfig): Helia['blockstore']['batch'] {
  const batch = (): Batch => {
    let puts: Pair[] = []
    let dels: CID[] = []

    const batch: Batch = {
      put (key, value) {
        puts.push({ key, value })
      },

      delete (key) {
        dels.push(key)
      },

      commit: async (options) => {
        const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

        try {
          const stream = pbStream(duplex)

          stream.writePB({
            resource: '/blockstore/batch',
            method: 'INVOKE',
            authorization: config.authorization,
            options: BatchOptions.encode({
              ...options
            })
          }, RPCCallRequest)

          for (const { key, value } of puts) {
            stream.writePB({
              type: RPCCallMessageType.RPC_CALL_MESSAGE,
              message: BatchRequest.encode({
                type: BatchRequestType.BATCH_REQUEST_PUT,
                message: BatchRequestPut.encode({
                  cid: key.bytes,
                  block: value
                })
              })
            }, RPCCallMessage)
          }

          puts = []

          for (const cid of dels) {
            stream.writePB({
              type: RPCCallMessageType.RPC_CALL_MESSAGE,
              message: BatchRequest.encode({
                type: BatchRequestType.BATCH_REQUEST_DELETE,
                message: BatchRequestDelete.encode({
                  cid: cid.bytes
                })
              })
            }, RPCCallMessage)
          }

          dels = []

          stream.writePB({
            type: RPCCallMessageType.RPC_CALL_MESSAGE,
            message: BatchRequest.encode({
              type: BatchRequestType.BATCH_REQUEST_COMMIT
            })
          }, RPCCallMessage)
        } finally {
          duplex.close()
        }
      }
    }

    return batch
  }

  return batch
}
