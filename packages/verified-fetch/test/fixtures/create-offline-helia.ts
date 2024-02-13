import { Helia as HeliaClass } from '@helia/utils'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import type { Helia } from '@helia/interface'

export async function createHelia (): Promise<Helia> {
  const datastore = new MemoryDatastore()
  const blockstore = new MemoryBlockstore()

  const helia = new HeliaClass({
    datastore,
    blockstore,
    blockBrokers: [],
    routers: []
  })

  await helia.start()

  return helia
}
