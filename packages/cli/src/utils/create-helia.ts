import type { Helia } from '@helia/interface'
import type { HeliaConfig } from '../index.js'
import { createHelia as createHeliaNode } from 'helia'
import { FsDatastore } from 'datastore-fs'
import { BlockstoreDatastoreAdapter } from 'blockstore-datastore-adapter'
import { unixfs } from '@helia/unixfs'
import { createLibp2p } from 'libp2p'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { prometheusMetrics } from '@libp2p/prometheus-metrics'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import stripJsonComments from 'strip-json-comments'
import fs from 'node:fs'
import path from 'node:path'

export async function createHelia (configDir: string, offline: boolean = false): Promise<Helia> {
  const config: HeliaConfig = JSON.parse(stripJsonComments(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8')))
  const peerId = await peerIdFromKeys(
    fs.readFileSync(path.join(configDir, 'peer.pub')),
    fs.readFileSync(path.join(configDir, 'peer.key'))
  )

  const datastore = new FsDatastore(config.datastore)

  return await createHeliaNode({
    blockstore: new BlockstoreDatastoreAdapter(new FsDatastore(config.blockstore)),
    datastore,
    filesystems: [
      unixfs()
    ],
    libp2p: await createLibp2p({
      start: !offline,
      peerId,
      datastore,
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
      dht: kadDHT(),
      metrics: prometheusMetrics()
    })
  })
}
