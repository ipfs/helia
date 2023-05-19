import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { ipniContentRouting } from '@libp2p/ipni-content-routing'
import { type DualKadDHT, kadDHT } from '@libp2p/kad-dht'
import { mdns } from '@libp2p/mdns'
import { mplex } from '@libp2p/mplex'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p as create } from 'libp2p'
import { autoNATService } from 'libp2p/autonat'
import { circuitRelayTransport, circuitRelayServer, type CircuitRelayService } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { uPnPNATService } from 'libp2p/upnp-nat'
import { bootstrapConfig } from './bootstrappers.js'
import type { Libp2p } from '@libp2p/interface-libp2p'
import type { PubSub } from '@libp2p/interface-pubsub'
import type { Datastore } from 'interface-datastore'

export interface CreateLibp2pOptions {
  datastore: Datastore
  start?: boolean
}

export async function createLibp2p (opts: CreateLibp2pOptions): Promise<Libp2p<{ dht: DualKadDHT, pubsub: PubSub, relay: CircuitRelayService }>> {
  return create({
    ...opts,
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/0'
      ]
    },
    transports: [
      tcp(),
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
      mdns(),
      bootstrap(bootstrapConfig)
    ],
    contentRouters: [
      ipniContentRouting('https://cid.contact')
    ],
    services: {
      identify: identifyService(),
      autoNAT: autoNATService(),
      upnp: uPnPNATService(),
      pubsub: gossipsub(),
      dht: kadDHT(),
      relay: circuitRelayServer({
        advertise: true
      })
    }
  })
}
