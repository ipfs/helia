import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { ipniContentRouting } from '@libp2p/ipni-content-routing'
import { kadDHT, type DualKadDHT } from '@libp2p/kad-dht'
import { mplex } from '@libp2p/mplex'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { createLibp2p as create } from 'libp2p'
import { autoNATService } from 'libp2p/autonat'
import { circuitRelayTransport, circuitRelayServer } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { bootstrapConfig } from './bootstrappers.js'
import type { CreateLibp2pOptions } from './libp2p.js'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { PubSub } from '@libp2p/interface-pubsub'

export async function createLibp2p (opts: CreateLibp2pOptions): Promise<Libp2p<{ dht: DualKadDHT, pubsub: PubSub }>> {
  return create({
    ...opts,
    addresses: {
      listen: [
        '/webrtc'
      ]
    },
    transports: [
      webRTC(),
      webRTCDirect(),
      webTransport(),
      webSockets(),
      circuitRelayTransport({
        discoverRelays: 1
      })
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
    contentRouters: [
      ipniContentRouting('https://cid.contact')
    ],
    services: {
      identify: identifyService(),
      autoNAT: autoNATService(),
      pubsub: gossipsub(),
      dht: kadDHT({
        clientMode: true
      }),
      relay: circuitRelayServer({
        advertise: true
      })
    }
  })
}
