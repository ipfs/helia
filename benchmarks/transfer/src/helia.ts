import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import type { TransferBenchmark } from './index.js'
import os from 'node:os'
import path from 'node:path'
import { LevelDatastore } from 'datastore-level'
import { FsBlockstore } from 'blockstore-fs'
import drain from 'it-drain'
import { unixfs } from '@helia/unixfs'
// import { fixedSize } from 'ipfs-unixfs-importer/chunker'
// import { balanced } from 'ipfs-unixfs-importer/layout'

export async function createHeliaBenchmark (): Promise<TransferBenchmark> {
  const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)

  const helia = await createHelia({
    blockstore: new FsBlockstore(`${repoPath}/blocks`),
    datastore: new LevelDatastore(`${repoPath}/data`),
    libp2p: await createLibp2p({
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
      ]
    })
  })

  return {
    async teardown () {
      await helia.stop()
    },
    async addr () {
      return helia.libp2p.getMultiaddrs()[0]
    },
    async dial (ma) {
      await helia.libp2p.dial(ma)
    },
    async add (content) {
      const fs = unixfs(helia)

      return await fs.addByteStream(content)
    },
    async get (cid) {
      const fs = unixfs(helia)

      await drain(fs.cat(cid))
    }
  }
}
