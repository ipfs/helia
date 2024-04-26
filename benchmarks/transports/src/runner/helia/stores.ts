import os from 'node:os'
import path from 'node:path'
import { FsBlockstore } from 'blockstore-fs'
import { LevelDatastore } from 'datastore-level'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

export async function getStores (): Promise<{ blockstore: Blockstore, datastore: Datastore }> {
  const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)

  return {
    blockstore: new FsBlockstore(`${repoPath}/blocks`),
    datastore: new LevelDatastore(`${repoPath}/data`)
  }
}
