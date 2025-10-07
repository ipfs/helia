import type { DelegatedRoutingV1HttpApiClientInit } from '@helia/delegated-routing-v1-http-api-client'

export function delegatedHTTPRoutingDefaults (): DelegatedRoutingV1HttpApiClientInit {
  return {
    filterProtocols: ['unknown', 'transport-bitswap', 'transport-ipfs-gateway-http'],
    filterAddrs: ['https', 'tcp', 'webrtc', 'webrtc-direct', 'wss', 'tls']
  }
}
