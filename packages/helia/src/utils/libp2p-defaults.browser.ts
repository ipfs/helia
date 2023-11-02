import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { bootstrap } from '@libp2p/bootstrap'
import { type DualKadDHT, kadDHT } from '@libp2p/kad-dht'
import { mplex } from '@libp2p/mplex'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import { autoNATService } from 'libp2p/autonat'
import { circuitRelayTransport } from 'libp2p/circuit-relay'
import { dcutrService } from 'libp2p/dcutr'
import { type IdentifyService, identifyService } from 'libp2p/identify'
import { pingService, type PingService } from 'libp2p/ping'
import { bootstrapConfig } from './bootstrappers.js'
import type { PubSub } from '@libp2p/interface/pubsub'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  dht: DualKadDHT
  delegatedRouting: unknown
  pubsub: PubSub
  identify: IdentifyService
  autoNAT: unknown
  dcutr: unknown
  ping: PingService
}

export function libp2pDefaults (): Libp2pOptions<DefaultLibp2pServices> {
  return {
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
      identify: identifyService(),
      autoNAT: autoNATService(),
      pubsub: gossipsub(),
      dcutr: dcutrService(),
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
      ping: pingService()
    }
  }
}
