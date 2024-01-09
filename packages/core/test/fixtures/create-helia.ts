import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bitswap } from '@helia/block-brokers'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as Filters from '@libp2p/websockets/filters'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { Helia as HeliaClass, type HeliaInit } from '../../src/index.js'
import type { Helia } from '@helia/interface'

export async function createHelia (opts: Partial<HeliaInit> = {}): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()

  const init: HeliaInit = {
    datastore,
    blockstore,
    blockBrokers: [
      bitswap()
    ],
    libp2p: opts.libp2p ?? await createLibp2p({
      datastore,
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
      streamMuxers: [
        yamux()
      ],
      connectionEncryption: [
        noise()
      ],
      connectionGater: {
        denyDialMultiaddr: async () => false
      },
      services: {
        identify: identify()
      }
    }),
    ...opts
  }

  const node = new HeliaClass(init)
  await node.start()

  return node
}
