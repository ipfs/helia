import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia } from 'helia'
import { createLibp2p, type Libp2pOptions } from 'libp2p'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'
import type { IdentifyService } from 'libp2p/identify'

export async function createHeliaNode <T extends { identify: IdentifyService }> (config: Libp2pOptions<T> = {}): Promise<Helia<Libp2p<T>>> {
  const blockstore = new MemoryBlockstore()
  const datastore = new MemoryDatastore()

  const libp2p = await createLibp2p({
    addresses: {
      listen: [
        '/ip4/127.0.0.1/tcp/0'
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
    ...config
  })

  const helia = await createHelia({
    libp2p,
    blockstore,
    datastore
  })

  return helia
}
