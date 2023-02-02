import { DeleteManyOptions, DeleteManyRequest, DeleteManyResponse } from '@helia/rpc-protocol/blockstore'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { CID } from 'multiformats/cid'
import { streamingCall } from '../utils/rpc-call.js'

export function createBlockstoreDeleteMany (config: HeliaRpcMethodConfig): Helia['blockstore']['deleteMany'] {
  return streamingCall<DeleteManyOptions, DeleteManyRequest, DeleteManyResponse>({
    resource: '/blockstore/delete-many',
    optionsCodec: DeleteManyOptions,
    transformInput: (cid: CID) => {
      return {
        cid: cid.bytes
      }
    },
    inputCodec: DeleteManyRequest,
    outputCodec: DeleteManyResponse,
    transformOutput: (obj: DeleteManyResponse) => {
      return CID.decode(obj.cid)
    }
  })(config)
}
