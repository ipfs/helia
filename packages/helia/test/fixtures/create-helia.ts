import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as Filters from '@libp2p/websockets/filters'
import { bitswap } from '@helia/block-brokers'
import { createHelia as createNode } from '../../src/index.js'
import type { Helia } from '@helia/interface'

export async function createHelia (): Promise<Helia> {
  return createNode({
    blockBrokers: [
      bitswap()
    ],
    libp2p: {
      addresses: {
        listen: [
          `${process.env.RELAY_SERVER}/p2p-circuit`
        ]
      },
      transports: [
        webSockets({
          filter: Filters.all
        }),
        circuitRelayTransport()
      ],
      connectionGater: {
        denyDialMultiaddr: async () => false
      },
      services: {
        identify: identify()
      }
    }
  })
}
