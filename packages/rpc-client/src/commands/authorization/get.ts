import { GetOptions, GetRequest, GetResponse } from '@helia/rpc-protocol/authorization'
import type { HeliaRpcClientConfig } from '../../index.js'
import { unaryCall } from '../utils/rpc-call.js'

export function createAuthorizationGet (config: HeliaRpcClientConfig): (user: string, options?: any) => Promise<string> {
  return unaryCall<GetOptions, GetRequest, GetResponse>({
    resource: '/authorization/get',
    optionsCodec: GetOptions,
    transformInput: (user) => {
      return {
        user
      }
    },
    outputCodec: GetResponse,
    transformOutput: (obj) => {
      return obj.authorization
    }
  })(config)
}
