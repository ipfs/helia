import { createController } from 'ipfsd-ctl'
import last from 'it-last'
import { path as kuboPath } from 'kubo'
import * as goRpcClient from 'kubo-rpc-client'
import type { CID } from 'multiformats/cid'
import fs, { promises as fsPromises } from 'node:fs'
import nodePath from 'node:path'
import type { AddDirBenchmark } from './index.js'

export async function createKuboBenchmark (): Promise<AddDirBenchmark> {
  const controller = await createController({
    type: 'go',
    test: true,
    ipfsBin: kuboPath(),
    kuboRpcModule: goRpcClient,
    ipfsOptions: {
      init: {
        emptyRepo: true
      }
    }
  })

  const addFile = async (path: string): Promise<CID> => (await controller.api.add({ path: nodePath.relative(process.cwd(), path), content: fs.createReadStream(path) }, { cidVersion: 1, pin: false })).cid

  const addDir = async function (dir: string): Promise<CID> {
    // @ts-expect-error types are messed up
    const res = await last(controller.api.addAll(goRpcClient.globSource(nodePath.dirname(dir), `${nodePath.basename(dir)}/**/*`)))

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
