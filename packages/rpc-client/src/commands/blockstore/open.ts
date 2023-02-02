import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { unaryCall } from '../utils/rpc-call.js'
import { OpenOptions } from '@helia/rpc-protocol/blockstore'

export function createBlockstoreOpen (config: HeliaRpcMethodConfig): Helia['blockstore']['open'] {
  return unaryCall<OpenOptions>({
    resource: '/blockstore/open',
    optionsCodec: OpenOptions
  })(config)
}
