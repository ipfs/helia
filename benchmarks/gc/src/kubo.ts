/* eslint-disable no-console */

// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { createController } from 'ipfsd-ctl'
import all from 'it-all'
import drain from 'it-drain'
import * as goRpcClient from 'kubo-rpc-client'
import type { GcBenchmark } from './index.js'

export async function createKuboBenchmark (): Promise<GcBenchmark> {
  const controller = await createController({
    type: 'go',
    test: true,
    ipfsBin: goIpfs.path(),
    ipfsHttpModule: goRpcClient,
    ipfsOptions: {
      init: {
        emptyRepo: true
      }
    }
  })

  return {
    async gc () {
      await drain(controller.api.repo.gc())
    },
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

      const isPinned = result[0].type.includes('direct') || result[0].type.includes('indirect') || result[0].type.includes('recursive')

      if (!isPinned) {
        console.info(result)
      }

      return isPinned
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
