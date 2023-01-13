import type { Helia } from '@helia/interface'
import { HeliaError } from '@helia/interface/errors'
import { createId } from './handlers/id.js'
import { logger } from '@libp2p/logger'
import type { Source } from 'it-stream-types'
import type { Pushable } from 'it-pushable'
import { HELIA_RPC_PROTOCOL } from '@helia/rpc-protocol'
import { RPCCallRequest, RPCCallResponseType, RPCCallResponse } from '@helia/rpc-protocol/rpc'
import { decode, encode } from 'it-length-prefixed'
import { pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import * as ucans from '@ucans/ucans'

const log = logger('helia:grpc-server')

export interface RPCServerConfig {
  helia: Helia
  serverDid: string
}

export interface UnaryResponse<ResponseType> {
  value: ResponseType
  metadata: Record<string, any>
}

export interface Service {
  insecure?: true
  handle: (options: Uint8Array, source: Source<Uint8Array | Uint8ArrayList>, sink: Pushable<Uint8Array | Uint8ArrayList>, signal: AbortSignal) => Promise<void>
}

class RPCError extends HeliaError {
  constructor (message: string, code: string) {
    super(message, 'RPCError', code)
  }
}

export async function createHeliaRpcServer (config: RPCServerConfig): Promise<void> {
  const { helia } = config

  const services: Record<string, Service> = {
    '/id': createId(config)
  }

  await helia.libp2p.handle(HELIA_RPC_PROTOCOL, ({ stream }) => {
    const controller = new AbortController()
    const outputStream = pushable<Uint8Array | Uint8ArrayList>()
    const inputStream = pushable<Uint8Array | Uint8ArrayList>()

    Promise.resolve().then(async () => {
      await stream.sink(encode()(outputStream))
    })
      .catch(err => {
        log.error('error writing to stream', err)
        controller.abort()
      })

    Promise.resolve().then(async () => {
      let started = false

      for await (const buf of decode()(stream.source)) {
        if (!started) {
          // first message is request
          started = true

          const request = RPCCallRequest.decode(buf)

          log('incoming RPC request %s %s', request.method, request.resource)

          const service = services[request.resource]

          if (service == null) {
            log('no handler defined for %s %s', request.method, request.resource)
            const error = new RPCError(`Request path "${request.resource}" unimplemented`, 'ERR_PATH_UNIMPLEMENTED')

            // no handler for path
            outputStream.push(RPCCallResponse.encode({
              type: RPCCallResponseType.error,
              errorName: error.name,
              errorMessage: error.message,
              errorStack: error.stack,
              errorCode: error.code
            }))
            outputStream.end()
            return
          }

          if (service.insecure == null) {
            // authorize request
            const result = await ucans.verify(request.authorization, {
              audience: request.user,
              isRevoked: async ucan => false,
              requiredCapabilities: [{
                capability: {
                  with: { scheme: 'service', hierPart: request.resource },
                  can: { namespace: 'service', segments: [request.method] }
                },
                rootIssuer: config.serverDid
              }]
            })

            if (!result.ok) {
              log('authorization failed for %s %s', request.method, request.resource)
              const error = new RPCError(`Authorisation failed for ${request.method} ${request.resource}`, 'ERR_AUTHORIZATION_FAILED')

              // no handler for path
              outputStream.push(RPCCallResponse.encode({
                type: RPCCallResponseType.error,
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                errorCode: error.code
              }))
              outputStream.end()
              return
            }
          }

          service.handle(request.options, inputStream, outputStream, controller.signal)
            .then(() => {
              log.error('handler succeeded for %s %s', request.method, request.resource)
            })
            .catch(err => {
              log.error('handler failed for %s %s', request.method, request.resource, err)
              outputStream.push(RPCCallResponse.encode({
                type: RPCCallResponseType.error,
                errorName: err.name,
                errorMessage: err.message,
                errorStack: err.stack,
                errorCode: err.code
              }))
            })
            .finally(() => {
              log('handler finished for %s %s', request.method, request.resource)
              inputStream.end()
              outputStream.end()
            })

          continue
        }

        // stream all other input to the handler
        inputStream.push(buf)
      }
    })
      .catch(err => {
        log.error('stream errored', err)

        stream.abort(err)
        controller.abort()
      })
      .finally(() => {
        inputStream.end()
      })
  })
}
