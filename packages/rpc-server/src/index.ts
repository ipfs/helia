import type { Helia } from '@helia/interface'
import { HeliaError } from '@helia/interface/errors'
import { createInfo } from './handlers/info.js'
import { logger } from '@libp2p/logger'
import { HELIA_RPC_PROTOCOL } from '@helia/rpc-protocol'
import { RPCCallRequest, RPCCallResponseType, RPCCallResponse } from '@helia/rpc-protocol/rpc'
import * as ucans from '@ucans/ucans'
import { createDelete } from './handlers/blockstore/delete.js'
import { createGet } from './handlers/blockstore/get.js'
import { createHas } from './handlers/blockstore/has.js'
import { createPut } from './handlers/blockstore/put.js'
import { pbStream, ProtobufStream } from 'it-pb-stream'
import { createAuthorizationGet } from './handlers/authorization/get.js'
import { EdKeypair } from '@ucans/ucans'
import type { KeyChain } from '@libp2p/interface-keychain'
import { base58btc } from 'multiformats/bases/base58'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import type { PeerId } from '@libp2p/interface-peer-id'

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

  const services: Record<string, Service> = {
    '/authorization/get': createAuthorizationGet(config),
    '/blockstore/delete': createDelete(config),
    '/blockstore/get': createGet(config),
    '/blockstore/has': createHas(config),
    '/blockstore/put': createPut(config),
    '/info': createInfo(config)
  }

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
          stream: pb,
          signal: controller.signal
        })
        log('handler succeeded for %s %s', request.method, request.resource)
      } catch (err: any) {
        log.error('handler failed', err)
        pb.writePB({
          type: RPCCallResponseType.error,
          errorName: err.name,
          errorMessage: err.message,
          errorStack: err.stack,
          errorCode: err.code
        }, RPCCallResponse)
      }
    })
  })
}
