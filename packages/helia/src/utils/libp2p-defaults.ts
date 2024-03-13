import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport, circuitRelayServer, type CircuitRelayService } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { type Identify, identify } from '@libp2p/identify'
import { type KadDHT, kadDHT } from '@libp2p/kad-dht'
import { keychain, type Keychain } from '@libp2p/keychain'
import { mdns } from '@libp2p/mdns'
import { mplex } from '@libp2p/mplex'
import { ping, type PingService } from '@libp2p/ping'
import { tcp } from '@libp2p/tcp'
import { uPnPNAT } from '@libp2p/upnp-nat'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
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
  relay: CircuitRelayService
  upnp: unknown
}

export function libp2pDefaults (options: Libp2pDefaultsOptions = {}): Libp2pOptions<DefaultLibp2pServices> {
  return {
    peerId: options.peerId,
    dns: options.dns,
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/0',
        '/ip6/::/tcp/0',
        '/webrtc'
      ]
    },
    transports: [
      circuitRelayTransport({
        discoverRelays: 1
      }),
      tcp(),
      webRTC(),
      webRTCDirect(),
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
      mdns(),
      bootstrap(bootstrapConfig)
    ],
    services: {
      autoNAT: autoNAT(),
      dcutr: dcutr(),
      delegatedRouting: () => createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev'),
      dht: kadDHT({
        validators: {
          ipns: ipnsValidator
        },
        selectors: {
          ipns: ipnsSelector
        }
      }),
      identify: identify({
        agentVersion: `${name}/${version} ${libp2pInfo.name}/${libp2pInfo.version} UserAgent=${globalThis.process.version}`
      }),
      keychain: keychain(options.keychain),
      ping: ping(),
      relay: circuitRelayServer({
        advertise: true
      }),
      upnp: uPnPNAT()
    }
  }
}
