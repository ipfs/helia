import drain from 'it-drain'
import type { GcBenchmark } from './index.js'
import all from 'it-all'
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import * as goRpcClient from 'kubo-rpc-client'

import { createController } from 'ipfsd-ctl'

export async function createKuboBenchmark (): Promise<GcBenchmark> {
  const controller = await createController({
    type: 'go',
    test: true,
    ipfsBin: goIpfs.path(),
    ipfsHttpModule: goRpcClient
  })

  return {
    async gc () {
      await drain(controller.api.repo.gc())
    },
    async putBlock (cid, block) {
      await controller.api.block.put(block)
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
    }
  }
}
