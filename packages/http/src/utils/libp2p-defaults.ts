import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import type { Libp2pDefaultsOptions } from './libp2p.js'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  delegatedRouting: unknown
}

export function libp2pDefaults (options: Libp2pDefaultsOptions = {}): Libp2pOptions<DefaultLibp2pServices> {
  return {
    services: {
      delegatedRouting: () => createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')
    },
    connectionManager: {
      minConnections: 0
    },
    ...options
  }
}
