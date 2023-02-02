import type { Helia } from '@helia/interface'
import { HeliaError } from '@helia/interface/errors'
import { logger } from '@libp2p/logger'
import { HELIA_RPC_PROTOCOL } from '@helia/rpc-protocol'
import { RPCCallRequest, RPCCallError, RPCCallMessageType, RPCCallMessage } from '@helia/rpc-protocol/rpc'
import * as ucans from '@ucans/ucans'
import { pbStream, ProtobufStream } from 'it-pb-stream'
import { EdKeypair } from '@ucans/ucans'
import type { KeyChain } from '@libp2p/interface-keychain'
import { base58btc } from 'multiformats/bases/base58'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import type { PeerId } from '@libp2p/interface-peer-id'
import { createServices } from './handlers/index.js'

const log = logger('helia:rpc-server')

export interface RPCServerConfig {
  helia: Helia
  users: KeyChain
  authorizationValiditySeconds: number
}

export interface UnaryResponse<ResponseType> {
  value: ResponseType
  metadata: Record<string, any>
}

export interface ServiceArgs {
  peerId: PeerId
  options: Uint8Array
  stream: ProtobufStream
  signal: AbortSignal
}

export interface Service {
  insecure?: true
  handle: (args: ServiceArgs) => Promise<void>
}

class RPCError extends HeliaError {
  constructor (message: string, code: string) {
    super(message, 'RPCError', code)
  }
}

export async function createHeliaRpcServer (config: RPCServerConfig): Promise<void> {
  const { helia } = config

  if (helia.libp2p.peerId.privateKey == null || helia.libp2p.peerId.publicKey == null) {
    // should never happen
    throw new Error('helia.libp2p.peerId was missing public or private key component')
  }

  const serverKey = new EdKeypair(
    helia.libp2p.peerId.privateKey.subarray(4),
    helia.libp2p.peerId.publicKey.subarray(4),
    false
  )

  const services = createServices(config)

  await helia.libp2p.handle(HELIA_RPC_PROTOCOL, ({ stream, connection }) => {
    const controller = new AbortController()

    void Promise.resolve().then(async () => {
      const pb = pbStream(stream)

      try {
        const request = await pb.readPB(RPCCallRequest)
        const service = services[request.resource]

        if (service == null) {
          log('no handler defined for %s %s', request.method, request.resource)
          throw new RPCError(`Request path "${request.resource}" unimplemented`, 'ERR_PATH_UNIMPLEMENTED')
        }

        log('incoming RPC request %s %s', request.method, request.resource)

        if (service.insecure == null) {
          if (request.authorization == null) {
            log('authorization missing for %s %s', request.method, request.resource)
            throw new RPCError(`Authorisation failed for ${request.method} ${request.resource}`, 'ERR_AUTHORIZATION_FAILED')
          }

          log('authorizing request %s %s', request.method, request.resource)

          const peerId = connection.remotePeer

          if (peerId.publicKey == null) {
            log('public key missing for %s %s', request.method, request.resource)
            throw new RPCError(`Authorisation failed for ${request.method} ${request.resource}`, 'ERR_AUTHORIZATION_FAILED')
          }

          const audience = `did:key:${base58btc.encode(uint8ArrayConcat([
            Uint8Array.from([0xed, 0x01]),
            peerId.publicKey.subarray(4)
          ], peerId.publicKey.length - 2))}`

          // authorize request
          const result = await ucans.verify(request.authorization, {
            audience,
            requiredCapabilities: [{
              capability: {
                with: { scheme: 'helia-rpc', hierPart: request.resource },
                can: { namespace: 'helia-rpc', segments: [request.method] }
              },
              rootIssuer: serverKey.did()
            }]
          })

          if (!result.ok) {
            log('authorization failed for %s %s', request.method, request.resource)
            throw new RPCError(`Authorisation failed for ${request.method} ${request.resource}`, 'ERR_AUTHORIZATION_FAILED')
          }
        }

        await service.handle({
          peerId: connection.remotePeer,
          options: request.options ?? new Uint8Array(),
          signal: controller.signal,
          stream: pb
        })
        log('handler succeeded for %s %s', request.method, request.resource)

        pb.writePB({
          type: RPCCallMessageType.RPC_CALL_DONE
        }, RPCCallMessage)
      } catch (err: any) {
        log.error('handler failed', err)
        pb.writePB({
          type: RPCCallMessageType.RPC_CALL_ERROR,
          message: RPCCallError.encode({
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code
          })
        }, RPCCallMessage)
      } finally {
        stream.closeWrite()
      }
    })
  })
}
