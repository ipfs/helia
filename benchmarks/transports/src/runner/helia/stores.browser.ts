import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

export async function getStores (): Promise<{ blockstore: Blockstore, datastore: Datastore }> {
  const repoPath = `helia-${Math.random()}`
  const blockstore = new IDBBlockstore(`${repoPath}/blocks`)
  await blockstore.open()

  const datastore = new IDBDatastore(`${repoPath}/data`)
  await datastore.open()

  return {
    blockstore,
    datastore
  }
}
