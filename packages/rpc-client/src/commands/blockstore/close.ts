import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { unaryCall } from '../utils/rpc-call.js'
import { CloseOptions } from '@helia/rpc-protocol/blockstore'

export function createBlockstoreClose (config: HeliaRpcMethodConfig): Helia['blockstore']['close'] {
  return unaryCall<CloseOptions>({
    resource: '/blockstore/close',
    optionsCodec: CloseOptions
  })(config)
}
