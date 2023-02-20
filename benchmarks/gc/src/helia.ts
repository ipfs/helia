import { createHelia, DAGWalker } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import type { GcBenchmark } from './index.js'
import * as dagPb from '@ipld/dag-pb'
import all from 'it-all'
import os from 'node:os'
import path from 'node:path'
import { LevelDatastore } from 'datastore-level'
import { BlockstoreDatastoreAdapter } from 'blockstore-datastore-adapter'
import { ShardingDatastore } from 'datastore-core/sharding'
import { NextToLast } from 'datastore-core/shard'
import { FsDatastore } from 'datastore-fs'

const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  async * walk (block) {
    const node = dagPb.decode(block)

    yield * node.Links.map(l => l.Hash)
  }
}

export async function createHeliaBenchmark (): Promise<GcBenchmark> {
  const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)

  const helia = await createHelia({
    blockstore: new BlockstoreDatastoreAdapter(
      new ShardingDatastore(
        new FsDatastore(`${repoPath}/blocks`, {
          extension: '.data'
        }),
        new NextToLast(2)
      )
    ),
    datastore: new LevelDatastore(`${repoPath}/data`),
    libp2p: await createLibp2p({
      transports: [
        webSockets()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ]
    }),
    dagWalkers: [
      dagPbWalker
    ],
    start: false
  })

  return {
    async gc () {
      await helia.gc()
    },
    async putBlock (cid, block) {
      await helia.blockstore.put(cid, block)
    },
    async pin (cid) {
      await helia.pins.add(cid)
    },
    async teardown () {
      await helia.stop()
    },
    async clearPins () {
      const pins = await all(helia.pins.ls())

      for (const pin of pins) {
        await helia.pins.rm(pin.cid)
      }
    }
  }
}
