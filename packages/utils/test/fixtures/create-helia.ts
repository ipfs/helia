import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { Helia as HeliaClass, type HeliaInit } from '../../src/index.js'
import type { Helia } from '@helia/interface'

export async function createHelia (opts: Partial<HeliaInit & { start?: boolean }> = {}): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()

  const init: HeliaInit = {
    datastore,
    blockstore,
    blockBrokers: [],
    holdGcLock: true,
    ...opts
  }

  const node = new HeliaClass(init)

  if (opts.start !== false) {
    await node.start()
  }

  return node
}
