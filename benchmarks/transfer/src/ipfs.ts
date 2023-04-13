import { create } from 'ipfs-core'
import drain from 'it-drain'
import type { TransferBenchmark } from './index.js'
import os from 'node:os'
import path from 'node:path'

export async function createIpfsBenchmark (): Promise<TransferBenchmark> {
  const repoPath = path.join(os.tmpdir(), `ipfs-${Math.random()}`)

  const ipfs = await create({
    config: {
      Addresses: {
        Swarm: [
          '/ip4/127.0.0.1/tcp/0'
        ]
      }
    },
    repo: repoPath,
    init: {
      emptyRepo: true
    },
    silent: true
  })

  return {
    async teardown () {
      await ipfs.stop()
    },
    async addr () {
      const id = await ipfs.id()

      return id.addresses[0]
    },
    async dial (ma) {
      await ipfs.swarm.connect(ma)
    },
    async add (content, options: any) {
      const { cid } = await ipfs.add(content)

      return cid
    },
    async get (cid) {
      await drain(ipfs.cat(cid))
    }
  }
}
