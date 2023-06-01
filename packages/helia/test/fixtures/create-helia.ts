import { webSockets } from '@libp2p/websockets'
import * as Filters from '@libp2p/websockets/filters'
import { circuitRelayTransport } from 'libp2p/circuit-relay'
import { identifyService } from 'libp2p/identify'
import { createHelia as createNode } from '../../src/index.js'
import type { Helia } from '@helia/interface'

export async function createHelia (): Promise<Helia> {
  return createNode({
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
        identify: identifyService()
      }
    }
  })
}
