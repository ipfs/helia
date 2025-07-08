import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { delegatedHTTPRoutingDefaults } from '@helia/routers'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { keychain } from '@libp2p/keychain'
import { mplex } from '@libp2p/mplex'
import { ping } from '@libp2p/ping'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { userAgent } from 'libp2p/user-agent'
import { name, version } from '../version.js'
import { bootstrapConfig } from './bootstrappers.js'
import type { Libp2pDefaultsOptions } from './libp2p.js'
import type { Identify } from '@libp2p/identify'
import type { KadDHT } from '@libp2p/kad-dht'
import type { Keychain } from '@libp2p/keychain'
import type { Ping } from '@libp2p/ping'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  autoNAT: unknown
  dcutr: unknown
  delegatedRouting: unknown
  dht: KadDHT
  identify: Identify
  keychain: Keychain
  ping: Ping
}

export function libp2pDefaults (options: Libp2pDefaultsOptions = {}): Libp2pOptions<DefaultLibp2pServices> & Required<Pick<Libp2pOptions<DefaultLibp2pServices>, 'services'>> {
  const agentVersion = `${name}/${version} ${userAgent()}`

  return {
    privateKey: options.privateKey,
    dns: options.dns,
    nodeInfo: {
      userAgent: agentVersion
    },
    addresses: {
      listen: [
        '/p2p-circuit',
        '/webrtc'
      ]
    },
    transports: [
      circuitRelayTransport(),
      webRTC(),
      webRTCDirect(),
      webSockets()
    ],
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux(),
      mplex()
    ],
    peerDiscovery: [
      bootstrap(bootstrapConfig)
    ],
    services: {
      autoNAT: autoNAT(),
      dcutr: dcutr(),
      delegatedRouting: () => createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev', delegatedHTTPRoutingDefaults()),
      dht: kadDHT({
        clientMode: true,
        validators: {
          ipns: ipnsValidator
        },
        selectors: {
          ipns: ipnsSelector
        }
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      keychain: keychain(options.keychain),
      ping: ping()
    }
  }
}
