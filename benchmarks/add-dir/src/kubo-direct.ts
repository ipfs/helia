import { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'
import { execa } from 'execa'
// @ts-expect-error no types
import * as goIpfs from 'go-ipfs'
import { CID } from 'multiformats/cid'
import type { AddDirBenchmark } from './index.js'

export async function createKuboDirectBenchmark (): Promise<AddDirBenchmark> {
  const repoDir = nodePath.join(os.tmpdir(), 'kubo-direct')

  await execa(goIpfs.path(), ['--repo-dir', repoDir, 'init'])

  const addDir = async function (dir: string): Promise<CID> {
    const { stdout } = await execa(goIpfs.path(), ['--repo-dir', repoDir, 'add', '-r', '--pin=false', dir])
    const lines = stdout.split('\n')
    const lastLine = lines.pop()
    const cid = CID.parse(lastLine?.split(' ')[1] as string)

    return cid
  }

  return {
    async teardown () {
      await fsPromises.rm(repoDir, { recursive: true, force: true })
    },
    addDir
  }
}
