import fs, { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'

import { createHelia, DAGWalker } from 'helia'
import * as dagPb from '@ipld/dag-pb'
import { LevelDatastore } from 'datastore-level'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { FsBlockstore } from 'blockstore-fs'
import { AddOptions, unixfs } from '@helia/unixfs'
import type { CID } from 'multiformats/cid'
import type { AddDirBenchmark } from './index.js'
import all from 'it-all'
// import { fixedSize, rabin } from 'ipfs-unixfs-importer/chunker'
// import { flat } from 'ipfs-unixfs-importer/layout'

const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  async * walk (block) {
    const node = dagPb.decode(block)

    yield * node.Links.map(l => l.Hash)
  }
}

const unixFsAddOptions: Partial<AddOptions> = {
  // rawLeaves: false,
  // leafType: 'file',
  // reduceSingleLeafToSelf: true,
  // shardSplitThresholdBytes: 262144,
  // layout: flat(),
  // chunker: fixedSize() ?? rabin()
  // chunker: rabin({ avgChunkSize: 262144 }) ?? fixedSize()
  // fileImportConcurrency: 500,
  // blockWriteConcurrency: 10
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
    start: false,
  })
  const unixFs = unixfs(helia)

  const addFile = (path: string): Promise<CID> => unixFs.addFile({
    path: nodePath.relative(process.cwd(), path),
    content: fs.createReadStream(path)
  }, unixFsAddOptions)

  const addDir = async function (dir: string): Promise<CID> {
    const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
    const parentDirectoryName = nodePath.dirname(dir).split(nodePath.sep).pop()
    let rootCID = await unixFs.addDirectory({ path: parentDirectoryName }, unixFsAddOptions)

    const children = await Promise.all(dirents.map(async dirent => {
      const path = nodePath.join(dir, dirent.name);
      const cid: CID = dirent.isDirectory() ? await addDir(path) : await addFile(path);
      return [cid, dirent.name] as const
    }));

    for (const [cid, name] of children) {
      rootCID = await unixFs.cp(cid, rootCID, name, { offline: true })
    }

    return rootCID;
  };

  const getFolderSize = async (cid: CID) => {
    const files = await all(unixFs.ls(cid))
    let size = BigInt(0)
    for (const file of files) {
      if (file.type === 'directory') {
        size += await getFolderSize(file.cid)
      } else {
        size += file.size
      }
    }
    return size
  }

  return {
    async teardown () {
      await helia.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir,
    getSize: getFolderSize
  }
}
