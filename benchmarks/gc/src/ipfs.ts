import { create } from 'ipfs-core'
import drain from 'it-drain'
import type { GcBenchmark } from './index.js'
import all from 'it-all'
import os from 'node:os'
import path from 'node:path'

export async function createIpfsBenchmark (): Promise<GcBenchmark> {
  const repoPath = path.join(os.tmpdir(), `ipfs-${Math.random()}`)

  const ipfs = await create({
    config: {
      Addresses: {
        Swarm: []
      }
    },
    repo: repoPath,
    start: false
  })

  return {
    async gc () {
      await drain(ipfs.repo.gc())
    },
    async putBlock (cid, block) {
      await ipfs.block.put(block)
    },
    async pin (cid) {
      await ipfs.pin.add(cid)
    },
    async teardown () {
      await ipfs.stop()
    },
    async clearPins () {
      const pins = await all(ipfs.pin.ls())

      for (const pin of pins) {
        if (pin.type !== 'recursive' && pin.type !== 'direct') {
          continue
        }

        await ipfs.pin.rm(pin.cid)
      }
    }
  }
}
