import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia } from 'helia'
import { createLibp2p, type Libp2pOptions } from 'libp2p'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'

export async function createHeliaNode <T extends { identify: any }> (config: Libp2pOptions<T> = {}): Promise<Helia<Libp2p<T>>> {
  const blockstore = new MemoryBlockstore()
  const datastore = new MemoryDatastore()

  // dial-only in the browser until webrtc browser-to-browser arrives
  const libp2p = await createLibp2p({
    transports: [
      webSockets({
        filter: all
      })
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    datastore,
    connectionGater: {
      denyDialMultiaddr: async () => false
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
