import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { Helia as HeliaClass } from '../../src/index.js'
import type { HeliaInit, HeliaConstructorInit } from '../../src/index.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'

export async function createHelia (opts: Partial<HeliaInit & { start?: boolean }> = {}): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()

  const init: HeliaConstructorInit<Libp2p> = {
    datastore,
    blockstore,
    blockBrokers: [],
    holdGcLock: true,
    // @ts-expect-error
    libp2p: {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve()
    },
    ...opts
  }

  const node = new HeliaClass(init)

  if (opts.start !== false) {
    await node.start()
  }

  return node
}
