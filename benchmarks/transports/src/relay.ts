import { createHelia, type HeliaLibp2p } from 'helia'
import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import type { Libp2p } from '@libp2p/interface'

export async function createRelay (): Promise<HeliaLibp2p<Libp2p<any>>> {
  return createHelia({
    libp2p: await createLibp2p({
      addresses: {
        listen: [
          '/ip4/127.0.0.1/tcp/0/ws'
        ]
      },
      transports: [
        webSockets()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      services: {
        identify: identify(),
        relay: circuitRelayServer({
          reservations: {
            maxReservations: Infinity
          }
        })
      },
      connectionManager: {
        minConnections: 0
      },
      connectionGater: {
        denyDialMultiaddr: async () => false
      }
    })
  })
}
