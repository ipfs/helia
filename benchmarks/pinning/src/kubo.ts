/* eslint-disable no-console */

import { createNode } from 'ipfsd-ctl'
import all from 'it-all'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient } from 'kubo-rpc-client'
import type { GcBenchmark } from './index.js'

export async function createKuboBenchmark (): Promise<GcBenchmark> {
  const controller = await createNode({
    type: 'kubo',
    test: true,
    bin: kuboPath(),
    rpc: kuboRpcClient,
    init: {
      emptyRepo: true
    }
  })

  return {
    async putBlocks (blocks) {
      for (const { value } of blocks) {
        await controller.api.block.put(value)
      }
    },
    async pin (cid) {
      await controller.api.pin.add(cid)
    },
    async teardown () {
      await controller.stop()
    },
    async clearPins () {
      const pins = await all(controller.api.pin.ls())

      for (const pin of pins) {
        if (pin.type !== 'recursive' && pin.type !== 'direct') {
          continue
        }

        await controller.api.pin.rm(pin.cid)
      }

      return pins.length
    },
    isPinned: async (cid) => {
      const result = await all(controller.api.pin.ls({
        paths: cid
      }))

      return result[0].type.includes('direct') || result[0].type.includes('indirect') || result[0].type.includes('recursive')
    },
    hasBlock: async (cid) => {
      try {
        await controller.api.block.get(cid)
        return true
      } catch {
        return false
      }
    }
  }
}
