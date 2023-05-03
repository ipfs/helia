import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia, type HeliaInit } from 'helia'
import { createLibp2p } from 'libp2p'
import type { Helia } from '@helia/interface'

export async function createHeliaNode (init?: Partial<HeliaInit>): Promise<Helia> {
  const blockstore = new MemoryBlockstore()
  const datastore = new MemoryDatastore()

  const libp2p = await createLibp2p({
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/0'
      ]
    },
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
    nat: {
      enabled: false
    }
  })

  const helia = await createHelia({
    libp2p,
    blockstore,
    datastore,
    ...init
  })

  return helia
}
