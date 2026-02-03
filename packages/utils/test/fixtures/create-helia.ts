import { defaultLogger } from '@libp2p/logger'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { isLibp2p, createLibp2p } from 'libp2p'
import { stubInterface } from 'sinon-ts'
import { Helia as HeliaClass } from '../../src/index.js'
import type { HeliaInit } from '../../src/index.js'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface'

export async function createHelia (opts: Partial<HeliaInit> = {}): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()
  let libp2p: Libp2p

  if (isLibp2p(opts.libp2p)) {
    libp2p = opts.libp2p
  } else if (opts.libp2p != null) {
    libp2p = await createLibp2p(opts.libp2p)
  } else {
    libp2p = stubInterface<Libp2p<any>>({
      logger: defaultLogger()
    })
  }

  const init = {
    datastore,
    blockstore,
    blockBrokers: [],
    holdGcLock: true,
    ...opts,
    libp2p
  }

  const node = new HeliaClass(init)

  if (opts.start !== false) {
    await node.start()
  }

  return node
}
