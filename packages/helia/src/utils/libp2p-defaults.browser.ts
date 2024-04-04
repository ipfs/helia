import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { type Identify, identify } from '@libp2p/identify'
import { type KadDHT, kadDHT } from '@libp2p/kad-dht'
import { keychain, type Keychain } from '@libp2p/keychain'
import { mplex } from '@libp2p/mplex'
import { ping, type PingService } from '@libp2p/ping'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import * as libp2pInfo from 'libp2p/version'
import { name, version } from '../version.js'
import { bootstrapConfig } from './bootstrappers.js'
import type { Libp2pDefaultsOptions } from './libp2p.js'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  autoNAT: unknown
  dcutr: unknown
  delegatedRouting: unknown
  dht: KadDHT
  identify: Identify
  keychain: Keychain
  ping: PingService
}

export function libp2pDefaults (options: Libp2pDefaultsOptions = {}): Libp2pOptions<DefaultLibp2pServices> {
  return {
    peerId: options.peerId,
    dns: options.dns,
    addresses: {
      listen: [
        '/webrtc'
      ]
    },
    transports: [
      circuitRelayTransport({
        discoverRelays: 1
      }),
      webRTC(),
      webRTCDirect(),
      webTransport(),
      webSockets()
    ],
    connectionEncryption: [
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
      delegatedRouting: () => createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev'),
      dht: kadDHT({
        clientMode: true,
        validators: {
          ipns: ipnsValidator
        },
        selectors: {
          ipns: ipnsSelector
        }
      }),
      identify: identify({
        agentVersion: `${name}/${version} ${libp2pInfo.name}/${libp2pInfo.version} UserAgent=${globalThis.navigator.userAgent}`
      }),
      keychain: keychain(options.keychain),
      ping: ping()
    }
  }
}
