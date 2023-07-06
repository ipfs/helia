import fs, { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'
import { create, globSource } from 'ipfs-core'
import last from 'it-last'
import type { AddDirBenchmark } from './index.js'
import type { CID } from 'multiformats/cid'

export async function createIpfsBenchmark (): Promise<AddDirBenchmark> {
  const repoPath = nodePath.join(os.tmpdir(), `ipfs-${Math.random()}`)

  const ipfs = await create({
    config: {
      Addresses: {
        Swarm: []
      }
    },
    repo: repoPath,
    start: false,
    init: {
      emptyRepo: true
    }
  })

  const addFile = async (path: string): Promise<CID> => (await ipfs.add({ path: nodePath.relative(process.cwd(), path), content: fs.createReadStream(path) }, { cidVersion: 1, pin: false })).cid

  const addDir = async function (dir: string): Promise<CID> {
    // @ts-expect-error types are messed up
    const res = await last(ipfs.addAll(globSource(nodePath.dirname(dir), `${nodePath.basename(dir)}/**/*`)))

    if (res == null) {
      throw new Error('Import failed')
    }

    return res.cid
  }

  return {
    async teardown () {
      await ipfs.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir
  }
}
