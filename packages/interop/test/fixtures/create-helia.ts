import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { tcp } from '@libp2p/tcp'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia } from 'helia'
import { bitswap } from 'helia/block-brokers'
import { createLibp2p } from 'libp2p'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'
import type { Libp2pOptions } from 'libp2p'

export async function createHeliaNode (config: Libp2pOptions = {}): Promise<Helia<Libp2p>> {
  const blockstore = new MemoryBlockstore()
  const datastore = new MemoryDatastore()

  const libp2p = await createLibp2p({
    transports: [
      tcp()
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    datastore,
    services: {
      identify: identify()
    },
    ...config
  })

  const helia = await createHelia({
    libp2p,
    blockstore,
    datastore,
    blockBrokers: [
      bitswap()
    ]
  })

  return helia
}
