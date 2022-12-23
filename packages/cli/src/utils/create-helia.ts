import type { Helia } from '@helia/interface'
import type { HeliaConfig } from '../index.js'
import { createHelia as createHeliaNode } from 'helia'
import { FsDatastore } from 'datastore-fs'
import { BlockstoreDatastoreAdapter } from 'blockstore-datastore-adapter'
import { unixfs } from '@helia/unixfs'
import { createLibp2p } from 'libp2p'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { fromString as uint8ArrayFromString } from 'uint8arrays'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'

export async function createHelia (config: HeliaConfig, offline: boolean = false): Promise<Helia> {
  const peerId = await peerIdFromKeys(
    uint8ArrayFromString(config.peerId.publicKey, 'base64url'),
    uint8ArrayFromString(config.peerId.privateKey, 'base64url')
  )

  return await createHeliaNode({
    blockstore: new BlockstoreDatastoreAdapter(new FsDatastore(config.blocks)),
    filesystems: [
      unixfs()
    ],
    libp2p: await createLibp2p({
      start: !offline,
      peerId,
      addresses: config.libp2p.addresses,
      identify: {
        host: {
          agentVersion: 'helia/0.0.0'
        }
      },
      transports: [
        tcp(),
        webSockets()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        yamux(),
        mplex()
      ],
      pubsub: gossipsub(),
      dht: kadDHT()
    })
  })
}
