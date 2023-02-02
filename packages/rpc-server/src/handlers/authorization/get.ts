import { GetRequest, GetResponse } from '@helia/rpc-protocol/authorization'
import { RPCCallMessage, RPCCallMessageType } from '@helia/rpc-protocol/rpc'
import type { RPCServerConfig, Service } from '../../index.js'
import * as ucans from '@ucans/ucans'
import { base58btc } from 'multiformats/bases/base58'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'

export function createAuthorizationGet (config: RPCServerConfig): Service {
  if (config.helia.libp2p.peerId.privateKey == null || config.helia.libp2p.peerId.publicKey == null) {
    throw new Error('Public/private key missing from peer id')
  }

  const issuer = new ucans.EdKeypair(
    config.helia.libp2p.peerId.privateKey.subarray(4),
    config.helia.libp2p.peerId.publicKey.subarray(4),
    false
  )

  return {
    insecure: true,
    async handle ({ peerId, stream }): Promise<void> {
      const request = await stream.readPB(GetRequest)
      const user = request.user

      const allowedPeerId = await config.users.exportPeerId(`rpc-user-${user}`)

      if (!allowedPeerId.equals(peerId)) {
        throw new Error('PeerIds did not match')
      }

      if (peerId.publicKey == null) {
        throw new Error('Public key component missing')
      }

      // derive the audience from the peer id
      const audience = `did:key:${base58btc.encode(uint8ArrayConcat([
        Uint8Array.from([0xed, 0x01]),
        peerId.publicKey.subarray(4)
      ], peerId.publicKey.length - 2))}`

      // authorize the remote peer for these operations
      const ucan = await ucans.build({
        audience,
        issuer,
        lifetimeInSeconds: config.authorizationValiditySeconds,
        capabilities: [
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/batch' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/close' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/delete-many' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/delete' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/get-many' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/get' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/has' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/put-many' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/put' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/query-keys' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          },
          {
            with: { scheme: 'helia-rpc', hierPart: '/blockstore/query' },
            can: { namespace: 'helia-rpc', segments: ['INVOKE'] }
          }
        ]
      })

      stream.writePB({
        type: RPCCallMessageType.RPC_CALL_MESSAGE,
        message: GetResponse.encode({
          authorization: ucans.encode(ucan)
        })
      },
      RPCCallMessage)
    }
  }
}
