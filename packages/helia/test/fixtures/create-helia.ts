import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { Helia as HeliaClass } from '../../src/helia.ts'
import type { HeliaInit } from '../../src/index.ts'
import type { Helia } from '@helia/interface'

export async function createHelia (opts: Partial<HeliaInit> = {}): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()

  const init = {
    name: 'test',
    version: '0.0.0',
    datastore,
    blockstore,
    blockBrokers: [],
    holdGcLock: true,
    ...opts
  }

  return new HeliaClass(init)
}
