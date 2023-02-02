import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import type { CID } from 'multiformats/cid'
import { unaryCall } from '../utils/rpc-call.js'
import { DeleteOptions, DeleteRequest } from '@helia/rpc-protocol/blockstore'

export function createBlockstoreDelete (config: HeliaRpcMethodConfig): Helia['blockstore']['delete'] {
  return unaryCall<DeleteOptions, DeleteRequest>({
    resource: '/blockstore/delete',
    optionsCodec: DeleteOptions,
    transformInput: (cid: CID) => {
      return {
        cid: cid.bytes
      }
    },
    inputCodec: DeleteRequest
  })(config)
}
