import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { keychain } from '@libp2p/keychain'
import { userAgent } from 'libp2p/user-agent'
import type { Libp2pDefaultsOptions } from './libp2p.js'
import type { Keychain } from '@libp2p/keychain'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  delegatedRouting: unknown
  keychain: Keychain
}

export function libp2pDefaults (options: Libp2pDefaultsOptions = {}): Libp2pOptions<DefaultLibp2pServices> & Required<Pick<Libp2pOptions<DefaultLibp2pServices>, 'services'>> {
  const agentVersion = `@helia/http ${userAgent()}`

  return {
    privateKey: options.privateKey,
    dns: options.dns,
    nodeInfo: {
      userAgent: agentVersion
    },
    addresses: {
      listen: []
    },
    transports: [],
    connectionEncrypters: [],
    streamMuxers: [],
    peerDiscovery: [],
    services: {
      delegatedRouting: () =>
        createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev', {
          filterAddrs: ['https'],
          filterProtocols: ['transport-ipfs-gateway-http']
        }),
      keychain: keychain(options.keychain)
    }
  }
}
