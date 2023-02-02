/* eslint max-depth: ["error", 5] */

import { RPCCallMessage, RPCCallRequest, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import { HELIA_RPC_PROTOCOL, RPCError, RPCProgressEvent } from '@helia/rpc-protocol'
import type { HeliaRpcMethodConfig } from '../../index.js'
import { pbStream } from 'it-pb-stream'
import first from 'it-first'
import { logger } from '@libp2p/logger'

const log = logger('helia:rpc-client:utils:rpc-call')

export interface Codec<T> {
  encode: (type: T) => Uint8Array
  decode: (buf: Uint8Array) => T
}

export interface CallOptions<Options, Request, Response = unknown> {
  resource: string
  optionsCodec: Codec<Options>
  transformOptions?: (obj: any) => Options
  transformInput?: (obj: any) => Request
  inputCodec?: Codec<Request>
  outputCodec?: Codec<Response>
  transformOutput?: (obj: Response) => any
}

export function streamingCall <Options, Request = unknown, Response = unknown> (opts: CallOptions<Options, Request, Response>): (config: HeliaRpcMethodConfig) => any {
  return function createStreamingCall (config: HeliaRpcMethodConfig): any {
    const streamingCall: any = async function * (source: any, options: any = {}) {
      const duplex = await config.libp2p.dialProtocol(config.multiaddr, HELIA_RPC_PROTOCOL)
      const stream = pbStream(duplex)

      stream.writePB({
        resource: opts.resource,
        method: 'INVOKE',
        authorization: config.authorization,
        options: opts.optionsCodec.encode(opts.transformOptions == null ? options : opts.transformOptions(options))
      }, RPCCallRequest)

      void Promise.resolve().then(async () => {
        for await (const input of source) {
          let message: Uint8Array | undefined

          if (opts.inputCodec != null) {
            message = opts.inputCodec.encode(opts.transformInput == null ? input : opts.transformInput(input))
          }

          stream.writePB({
            type: RPCCallMessageType.RPC_CALL_MESSAGE,
            message
          }, RPCCallMessage)
        }

        stream.writePB({
          type: RPCCallMessageType.RPC_CALL_DONE
        }, RPCCallMessage)
      })
        .catch(err => {
          log('error encountered while sending RPC messages', err)
        })
        .finally(() => {
          duplex.closeWrite()
        })

      try {
        while (true) {
          const response = await stream.readPB(RPCCallMessage)

          switch (response.type) {
            case RPCCallMessageType.RPC_CALL_DONE:
              return
            case RPCCallMessageType.RPC_CALL_ERROR:
              throw new RPCError(response.message)
            case RPCCallMessageType.RPC_CALL_MESSAGE:
              if (opts.outputCodec != null) {
                let message = opts.outputCodec.decode(response.message)

                if (opts.transformOutput != null) {
                  message = opts.transformOutput(message)
                }

                yield message
              }
              continue
            case RPCCallMessageType.RPC_CALL_PROGRESS:
              if (options.progress != null) {
                options.progress(new RPCProgressEvent(response.message))
              }
              continue
            default:
              throw new Error('Unknown RPCCallMessageType')
          }
        }
      } finally {
        duplex.closeRead()
      }
    }

    return streamingCall
  }
}

export function unaryCall <Options, Request = unknown, Response = unknown> (opts: CallOptions<Options, Request, Response>): (config: HeliaRpcMethodConfig) => any {
  return function createStreamingCall (config: HeliaRpcMethodConfig): any {
    const unaryCall: any = async function (arg: any, options: any = {}): Promise<any> {
      const fn: any = streamingCall(opts)(config)
      return await first(fn([arg], options))
    }

    return unaryCall
  }
}
