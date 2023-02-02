import { multiaddr } from '@multiformats/multiaddr'
import { InfoOptions, InfoResponse } from '@helia/rpc-protocol/root'
import type { Helia } from '@helia/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import type { HeliaRpcMethodConfig } from '../index.js'
import { unaryCall } from './utils/rpc-call.js'

export function createInfo (config: HeliaRpcMethodConfig): Helia['info'] {
  return unaryCall<InfoOptions, unknown, InfoResponse>({
    resource: '/info',
    optionsCodec: InfoOptions,
    transformOptions: (obj) => {
      return {
        ...obj,
        peerId: obj.peerId != null ? obj.peerId.toString() : undefined
      }
    },
    outputCodec: InfoResponse,
    transformOutput: (obj) => {
      return {
        ...obj,
        peerId: peerIdFromString(obj.peerId),
        multiaddrs: obj.multiaddrs.map(str => multiaddr(str))
      }
    }
  })(config)
}
