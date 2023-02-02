import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { CID } from 'multiformats/cid'
import { QueryOptions, QueryRequest, QueryResponse } from '@helia/rpc-protocol/blockstore'
import { streamingCall } from '../utils/rpc-call.js'

export function createBlockstoreQuery (config: HeliaRpcMethodConfig): Helia['blockstore']['query'] {
  return streamingCall<QueryOptions, QueryRequest, QueryResponse>({
    resource: '/blockstore/query',
    optionsCodec: QueryOptions,
    outputCodec: QueryResponse,
    transformOutput: (obj: QueryResponse) => {
      return {
        key: CID.decode(obj.key),
        value: obj.value
      }
    }
  })(config)
}
