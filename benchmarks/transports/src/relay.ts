import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { withBitswap } from '@helia/bitswap'
import { withLibp2p } from '@helia/libp2p'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { prefixLogger } from '@libp2p/logger'
import { webSockets } from '@libp2p/websockets'
import { createHeliaLight } from 'helia'
import type { HeliaWithLibp2p } from '@helia/libp2p'

export async function createRelay (): Promise<HeliaWithLibp2p> {
  const logger = prefixLogger('relay')

  return withBitswap(withLibp2p(createHeliaLight({
    logger,
    blockBrokers: [],
    routers: []
  }), {
    logger,
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/0/ws'
      ]
    },
    transports: [
      webSockets()
    ],
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: Infinity,
          applyDefaultLimit: false
        }
      })
    },
    connectionGater: {
      denyDialMultiaddr: async () => false
    }
  } as any))
}
