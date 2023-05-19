import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHelia, type HeliaInit } from 'helia'
import { createLibp2p } from 'libp2p'
import { identifyService } from 'libp2p/identify'
import type { Helia } from '@helia/interface'

export async function createHeliaNode (init?: Partial<HeliaInit>): Promise<Helia> {
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
    services: {
      identify: identifyService()
    },
    connectionGater: {
      // allow dialing loopback
      denyDialMultiaddr: () => false
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
