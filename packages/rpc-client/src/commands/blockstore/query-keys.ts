import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { CID } from 'multiformats/cid'
import { QueryKeysOptions, QueryKeysRequest, QueryKeysResponse } from '@helia/rpc-protocol/blockstore'
import { streamingCall } from '../utils/rpc-call.js'

export function createBlockstoreQueryKeys (config: HeliaRpcMethodConfig): Helia['blockstore']['queryKeys'] {
  return streamingCall<QueryKeysOptions, QueryKeysRequest, QueryKeysResponse>({
    resource: '/blockstore/query-keys',
    optionsCodec: QueryKeysOptions,
    outputCodec: QueryKeysResponse,
    transformOutput: (obj: QueryKeysResponse) => {
      return CID.decode(obj.key)
    }
  })(config)
}
