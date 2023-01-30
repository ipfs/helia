import { RPCCallRequest, RPCCallResponse, RPCCallResponseType } from '@helia/rpc-protocol/rpc'
import { GetOptions, GetRequest, GetResponse, GetResponseType } from '@helia/rpc-protocol/blockstore'
import { HELIA_RPC_PROTOCOL, RPCError } from '@helia/rpc-protocol'
import type { Helia } from '@helia/interface'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'
import type { CID } from 'multiformats/cid'
import { CustomEvent } from '@libp2p/interfaces/events'

export function createBlockstoreGet (config: HeliaRpcMethodConfig): Helia['blockstore']['get'] {
  const get: Helia['blockstore']['get'] = async (cid: CID, options = {}) => {
    const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)

    const stream = pbStream(duplex)
    stream.writePB({
      resource: '/blockstore/get',
      method: 'INVOKE',
      authorization: config.authorization,
      options: GetOptions.encode({
        ...options
      })
    }, RPCCallRequest)
    stream.writePB({
      cid: cid.bytes
    }, GetRequest)

    try {
      while (true) {
        const response = await stream.readPB(RPCCallResponse)

        if (response.type === RPCCallResponseType.error) {
          throw new RPCError(response)
        }

        if (response.type === RPCCallResponseType.message) {
          if (response.message == null) {
            throw new TypeError('RPC response had message type but no message')
          }

          const message = GetResponse.decode(response.message)

          if (message.type === GetResponseType.PROGRESS) {
            if (message.progressEventType == null) {
              throw new TypeError('GetResponse progress message missing event type')
            }

            // @ts-expect-error not in interface
            if (options.progress != null) {
              const event = new CustomEvent(message.progressEventType)

              // @ts-expect-error not in interface
              options.progress(event)
            }
          } else if (message.type === GetResponseType.RESULT) {
            if (message.block == null) {
              throw new TypeError('GetResponse result message missing block')
            }

            return message.block
          }
        }
      }
    } finally {
      duplex.close()
    }
  }

  return get
}
