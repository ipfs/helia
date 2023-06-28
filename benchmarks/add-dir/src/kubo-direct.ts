import type { AddDirBenchmark } from './index.js'
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { promises as fsPromises } from 'node:fs'
import nodePath from 'node:path'

import { CID } from 'multiformats/cid'
import { execa } from 'execa'
import os from 'node:os'

export async function createKuboDirectBenchmark (): Promise<AddDirBenchmark> {
  const repoDir = nodePath.join(os.tmpdir(), 'kubo-direct')

  await execa(goIpfs.path(), ['--repo-dir', repoDir, 'init'])

  const addDir = async function (dir: string): Promise<CID> {
    const {stdout} = await execa(goIpfs.path(), ['--repo-dir', repoDir, 'add', '-r', '--cid-version', '1', dir])
    const lines = stdout.split('\n')
    const lastLine = lines.pop()
    const cid = CID.parse(lastLine?.split(' ')[1] as string)

    return cid
  };


  return {
    async teardown () {
      await fsPromises.rm(repoDir, { recursive: true, force: true })
    },
    addDir
  }
}
