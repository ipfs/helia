import { GetManyOptions, GetManyRequest, GetManyResponse } from '@helia/rpc-protocol/blockstore'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import type { CID } from 'multiformats/cid'
import { streamingCall } from '../utils/rpc-call.js'

export function createBlockstoreGetMany (config: HeliaRpcMethodConfig): Helia['blockstore']['getMany'] {
  return streamingCall<GetManyOptions, GetManyRequest, GetManyResponse>({
    resource: '/blockstore/get-many',
    optionsCodec: GetManyOptions,
    transformInput: (cid: CID) => {
      return {
        cid: cid.bytes
      }
    },
    inputCodec: GetManyRequest,
    outputCodec: GetManyResponse,
    transformOutput: (obj) => {
      return obj.block
    }
  })(config)
}
