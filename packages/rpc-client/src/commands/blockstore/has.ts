import { HasOptions, HasRequest, HasResponse } from '@helia/rpc-protocol/blockstore'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import type { CID } from 'multiformats/cid'
import { unaryCall } from '../utils/rpc-call.js'

export function createBlockstoreHas (config: HeliaRpcMethodConfig): Helia['blockstore']['has'] {
  return unaryCall<HasOptions, HasRequest, HasResponse>({
    resource: '/blockstore/has',
    optionsCodec: HasOptions,
    transformInput: (cid: CID) => {
      return {
        cid: cid.bytes
      }
    },
    inputCodec: HasRequest,
    outputCodec: HasResponse,
    transformOutput: (obj) => {
      return obj.has
    }
  })(config)
}
