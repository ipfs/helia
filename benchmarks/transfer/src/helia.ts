import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { unixfs } from '@helia/unixfs'
import { identify } from '@libp2p/identify'
import { tcp } from '@libp2p/tcp'
import { FsBlockstore } from 'blockstore-fs'
import { LevelDatastore } from 'datastore-level'
import { createHelia } from 'helia'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import drain from 'it-drain'
import { createLibp2p } from 'libp2p'
import type { TransferBenchmark } from './index.js'

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
      connectionEncrypters: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      services: {
        identify: identify()
      }
    })
  })

  return {
    async teardown () {
      await helia.stop()
      await fs.rm(repoPath, {
        recursive: true,
        force: true
      })
    },
    async addr () {
      return helia.libp2p.getMultiaddrs()[0]
    },
    async dial (ma) {
      await helia.libp2p.dial(ma)
    },
    async add (content, options) {
      const fs = unixfs(helia)

      return fs.addByteStream(content, {
        ...options,
        chunker: options.chunkSize != null ? fixedSize({ chunkSize: options.chunkSize }) : undefined,
        layout: options.maxChildrenPerNode != null ? balanced({ maxChildrenPerNode: options.maxChildrenPerNode }) : undefined
      })
    },
    async get (cid) {
      const fs = unixfs(helia)

      await drain(fs.cat(cid))
    }
  }
}
