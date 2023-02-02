import { DeleteManyOptions, DeleteManyRequest, DeleteManyResponse } from '@helia/rpc-protocol/blockstore'
import { RPCCallMessage, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createBlockstoreDeleteMany (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const opts = DeleteManyOptions.decode(options)

      for await (const cid of config.helia.blockstore.deleteMany(
        (async function * () {
          while (true) {
            const request = await stream.readPB(DeleteManyRequest)

            yield CID.decode(request.cid)
          }
        })(), {
          signal,
          ...opts
        })) {
        stream.writePB({
          type: RPCCallMessageType.RPC_CALL_MESSAGE,
          message: DeleteManyResponse.encode({
            cid: cid.bytes
          })
        },
        RPCCallMessage)
      }
    }
  }
}
