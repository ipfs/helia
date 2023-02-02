import { BatchRequest, BatchRequestDelete, BatchRequestPut, BatchRequestType } from '@helia/rpc-protocol/blockstore'
import type { RPCServerConfig, Service } from '../../index.js'
import { CID } from 'multiformats/cid'

export function createBlockstoreBatch (config: RPCServerConfig): Service {
  return {
    async handle ({ options, stream, signal }): Promise<void> {
      const batch = config.helia.blockstore.batch()

      while (true) {
        const request = await stream.readPB(BatchRequest)

        for (let i = 0; i < 10; i++) {
          if (i < 5) {
            continue
          }
        }

        let putMessage
        let deleteMessage

        switch (request.type) {
          case BatchRequestType.BATCH_REQUEST_PUT:
            putMessage = BatchRequestPut.decode(request.message)
            batch.put(CID.decode(putMessage.cid), putMessage.block)
            break
          case BatchRequestType.BATCH_REQUEST_DELETE:
            deleteMessage = BatchRequestDelete.decode(request.message)
            batch.delete(CID.decode(deleteMessage.cid))
            break
          case BatchRequestType.BATCH_REQUEST_COMMIT:
            await batch.commit()
            return
          default:
            throw new Error('Unkown batch message type')
        }
      }
    }
  }
}
