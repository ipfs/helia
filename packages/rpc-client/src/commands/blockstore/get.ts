import { GetOptions, GetRequest, GetResponse } from '@helia/rpc-protocol/blockstore'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import type { CID } from 'multiformats/cid'
import { unaryCall } from '../utils/rpc-call.js'

export function createBlockstoreGet (config: HeliaRpcMethodConfig): Helia['blockstore']['get'] {
  return unaryCall<GetOptions, GetRequest, GetResponse>({
    resource: '/blockstore/get',
    optionsCodec: GetOptions,
    transformInput: (cid: CID) => {
      return {
        cid: cid.bytes
      }
    },
    inputCodec: GetRequest,
    outputCodec: GetResponse,
    transformOutput: (obj: GetResponse): Uint8Array => {
      return obj.block
    }
  })(config)
}
