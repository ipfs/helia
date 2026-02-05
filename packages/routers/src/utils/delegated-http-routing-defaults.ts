import type { DelegatedRoutingV1HttpApiClientInit } from '@helia/delegated-routing-v1-http-api-client'

export function delegatedHTTPRoutingDefaults (init?: DelegatedRoutingV1HttpApiClientInit): DelegatedRoutingV1HttpApiClientInit {
  return {
    url: 'https://delegated-ipfs.dev',
    filterProtocols: ['unknown', 'transport-bitswap', 'transport-ipfs-gateway-http'],
    filterAddrs: ['https', 'tcp', 'webrtc', 'webrtc-direct', 'wss', 'tls'],
    ...(init ?? {})
  }
}
