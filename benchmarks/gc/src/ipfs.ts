import os from 'node:os'
import path from 'node:path'
import { create } from 'ipfs-core'
import all from 'it-all'
import drain from 'it-drain'
import type { GcBenchmark } from './index.js'

export async function createIpfsBenchmark (): Promise<GcBenchmark> {
  const repoPath = path.join(os.tmpdir(), `ipfs-${Math.random()}`)

  const ipfs = await create({
    config: {
      Addresses: {
        Swarm: []
      }
    },
    repo: repoPath,
    start: false,
    init: {
      emptyRepo: true
    }
  })

  return {
    async gc () {
      await drain(ipfs.repo.gc())
    },
    async putBlocks (blocks) {
      for (const { value } of blocks) {
        await ipfs.block.put(value)
      }
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

      return pins.length
    },
    isPinned: async (cid) => {
      const result = await all(ipfs.pin.ls({
        paths: cid
      }))

      return result[0].type.includes('direct') || result[0].type.includes('indirect') || result[0].type.includes('recursive')
    },
    hasBlock: async (cid) => {
      try {
        await ipfs.block.get(cid)
        return true
      } catch {
        return false
      }
    }
  }
}
