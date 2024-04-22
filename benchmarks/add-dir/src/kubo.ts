import { createNode } from 'ipfsd-ctl'
import last from 'it-last'
import { path as kuboPath } from 'kubo'
import { globSource, create as kuboRpcClient } from 'kubo-rpc-client'
import type { CID } from 'multiformats/cid'
import fs, { promises as fsPromises } from 'node:fs'
import nodePath from 'node:path'
import type { AddDirBenchmark } from './index.js'

export async function createKuboBenchmark (): Promise<AddDirBenchmark> {
  const controller = await createNode({
    type: 'kubo',
    test: true,
    bin: kuboPath(),
    rpc: kuboRpcClient,
    init: {
      emptyRepo: true
    }
  })

  const addFile = async (path: string): Promise<CID> => (await controller.api.add({
    path: nodePath.relative(process.cwd(),path),
    content: fs.createReadStream(path)
  }, {
    cidVersion: 1,
    pin: false
  })).cid

  const addDir = async function (dir: string): Promise<CID> {
    const res = await last(controller.api.addAll(globSource(nodePath.dirname(dir), `${nodePath.basename(dir)}/**/*`)))

    if (res == null) {
      throw new Error('Import failed')
    }

    return res.cid
  }

  return {
    async teardown () {
      const { repoPath } = await controller.api.repo.stat()
      await controller.stop()
      await fsPromises.rm(repoPath, { recursive: true, force: true })
    },
    addFile,
    addDir
  }
}
