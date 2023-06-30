import fs, { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'

import { createHelia, DAGWalker } from 'helia'
import * as dagPb from '@ipld/dag-pb'
import { LevelDatastore } from 'datastore-level'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { FsBlockstore } from 'blockstore-fs'
import { AddOptions, unixfs, globSource } from '@helia/unixfs'
import type { CID } from 'multiformats/cid'
import type { AddDirBenchmark } from './index.js'
import last from 'it-last'
import { balanced } from 'ipfs-unixfs-importer/layout'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'

const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  async * walk (block) {
    const node = dagPb.decode(block)

    yield * node.Links.map(l => l.Hash)
  }
}

const unixFsAddOptions: Partial<AddOptions> = {
  // default kubo options
  cidVersion: 0,
  rawLeaves: false,
  layout: balanced({
    maxChildrenPerNode: 174
  }),
  chunker: fixedSize({
    chunkSize: 262144
  })
}
interface HeliaBenchmarkOptions {
  blockstoreType?: 'fs' | 'mem'
  datastoreType?: 'fs' | 'mem'
}

export async function createHeliaBenchmark ({ blockstoreType = 'fs', datastoreType = 'fs' }: HeliaBenchmarkOptions = {}): Promise<AddDirBenchmark> {
  const repoPath = nodePath.join(os.tmpdir(), `helia-${Math.random()}`)

  const helia = await createHelia({
    blockstore: blockstoreType === 'fs' ? new FsBlockstore(`${repoPath}/blocks`) : new MemoryBlockstore(),
    datastore: datastoreType === 'fs' ? new LevelDatastore(`${repoPath}/data`) : new MemoryDatastore(),
    dagWalkers: [
      dagPbWalker
    ],
    start: false
  })
  const unixFs = unixfs(helia)

  const addFile = async (path: string): Promise<CID> => await unixFs.addFile({
    path: nodePath.relative(process.cwd(), path),
    content: fs.createReadStream(path)
  }, unixFsAddOptions)

  const addDir = async function (dir: string): Promise<CID> {
    const res = await last(unixFs.addAll(globSource(nodePath.dirname(dir), `${nodePath.basename(dir)}/**/*`), unixFsAddOptions))

    if (res == null) {
      throw new Error('Import failed')
    }

    return res.cid
  }

  return {
    async teardown () {
      await helia.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir
  }
}
