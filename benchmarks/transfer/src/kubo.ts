import drain from 'it-drain'
import type { TransferBenchmark } from './index.js'
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import * as goRpcClient from 'kubo-rpc-client'
import { createController } from 'ipfsd-ctl'

export async function createKuboBenchmark (): Promise<TransferBenchmark> {
  const controller = await createController({
    type: 'go',
    test: true,
    ipfsBin: goIpfs.path(),
    ipfsHttpModule: goRpcClient,
    ipfsOptions: {
      init: {
        emptyRepo: true
      },
      config: {
        Addresses: {
          Swarm: [
            '/ip4/127.0.0.1/tcp/0'
          ]
        }
      },
      silent: true
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
      const { cid } = await controller.api.add(content)

      return cid
    },
    async get (cid) {
      await drain(controller.api.cat(cid))
    }
  }
}
