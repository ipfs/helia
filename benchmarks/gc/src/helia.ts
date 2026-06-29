import os from 'node:os'
import path from 'node:path'
import { withBitswap } from '@helia/bitswap'
import { withLibp2p } from '@helia/libp2p'
import { FsBlockstore } from 'blockstore-fs'
import { LevelDatastore } from 'datastore-level'
import { createHeliaLight } from 'helia'
import all from 'it-all'
import drain from 'it-drain'
import map from 'it-map'
import type { GcBenchmark } from './index.ts'

export async function createHeliaBenchmark (): Promise<GcBenchmark> {
  const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)

  const helia = withBitswap(withLibp2p(createHeliaLight({
    blockstore: new FsBlockstore(`${repoPath}/blocks`),
    datastore: new LevelDatastore(`${repoPath}/data`)
  }), {
    addresses: {
      listen: []
    }
  }))

  return {
    async gc () {
      await helia.gc()
    },
    async putBlocks (blocks) {
      await drain(helia.blockstore.putMany(map(blocks, ({ key, value }) => ({ cid: key, bytes: value }))))
    },
    async pin (cid) {
      await drain(helia.pins.add(cid))
    },
    async teardown () {
      await helia.stop()
    },
    async clearPins () {
      const pins = await all(helia.pins.ls())

      for (const pin of pins) {
        await drain(helia.pins.rm(pin.cid))
      }

      return pins.length
    },
    isPinned: async (cid) => {
      return helia.pins.isPinned(cid)
    },
    hasBlock: async (cid) => {
      return helia.blockstore.has(cid)
    }
  }
}
