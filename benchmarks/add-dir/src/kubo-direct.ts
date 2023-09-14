import { execa } from 'execa'
import { path as kuboPath } from 'kubo'
import { CID } from 'multiformats/cid'
import { promises as fsPromises } from 'node:fs'
import os from 'node:os'
import nodePath from 'node:path'
import type { AddDirBenchmark } from './index.js'

export async function createKuboDirectBenchmark (): Promise<AddDirBenchmark> {
  const repoDir = nodePath.join(os.tmpdir(), 'kubo-direct')

  await execa(kuboPath(), ['--repo-dir', repoDir, 'init'])

  const addDir = async function (dir: string): Promise<CID> {
    const { stdout } = await execa(kuboPath(), ['--repo-dir', repoDir, 'add', '-r', '--pin=false', dir])
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
