import drain from 'it-drain'
import type { TransferBenchmark } from './index.js'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient } from 'kubo-rpc-client'
import { createNode } from 'ipfsd-ctl'

export async function createKuboBenchmark (): Promise<TransferBenchmark> {
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
    async teardown () {
      await controller.stop()
    },
    async addr () {
      const id = await controller.api.id()

      return id.addresses[0]
    },
    async dial (ma) {
      await controller.api.swarm.connect(ma)
    },
    async add (content, options: any) {
      const { cid } = await controller.api.add(content, options)

      return cid
    },
    async get (cid) {
      await drain(controller.api.cat(cid))
    }
  }
}
