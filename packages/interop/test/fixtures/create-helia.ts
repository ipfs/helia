import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { tcp } from '@libp2p/tcp'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia } from 'helia'
import { createLibp2p, type Libp2pOptions } from 'libp2p'
import { identifyService } from 'libp2p/identify'
import type { Helia } from '@helia/interface'

export async function createHeliaNode (config: Libp2pOptions = {}): Promise<Helia> {
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
      identify: identifyService()
    },
    ...config
  })

  const helia = await createHelia({
    libp2p,
    blockstore,
    datastore
  })

  return helia
}
