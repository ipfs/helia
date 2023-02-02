import { unixfs } from '@helia/unixfs'
import merge from 'it-merge'
import path from 'node:path'
import { globSource } from '../utils/glob-source.js'
import fs from 'node:fs'
import { dateToMtime } from '../utils/date-to-mtime.js'
import type { Mtime } from 'ipfs-unixfs'
import type { ImportCandidate, UserImporterOptions } from 'ipfs-unixfs-importer'
import type { Command } from '@helia/cli-utils'

interface AddArgs {
  positionals: string[]
  fs: string
}

export const add: Command<AddArgs> = {
  command: 'add',
  description: 'Add a file or directory to your helia node',
  example: '$ unixfs add path/to/file.txt',
  async execute ({ positionals, helia, stdout }) {
    const options: UserImporterOptions = {
      cidVersion: 1,
      rawLeaves: true
    }
    const fs = unixfs(helia)

    for await (const result of fs.addStream(parsePositionals(positionals), options)) {
      stdout.write(`${result.cid}\n`)
    }
  }
}

async function * parsePositionals (positionals: string[], mode?: number, mtime?: Mtime, hidden?: boolean, recursive?: boolean, preserveMode?: boolean, preserveMtime?: boolean): AsyncGenerator<ImportCandidate, void, undefined> {
  if (positionals.length === 0) {
    yield {
      content: process.stdin,
      mode,
      mtime
    }
    return
  }

  yield * merge(...positionals.map(file => getSource(file, {
    hidden,
    recursive,
    preserveMode,
    preserveMtime,
    mode,
    mtime
  })))
}

interface SourceOptions {
  hidden?: boolean
  recursive?: boolean
  preserveMode?: boolean
  preserveMtime?: boolean
  mode?: number
  mtime?: Mtime
}

async function * getSource (target: string, options: SourceOptions = {}): AsyncGenerator<ImportCandidate, void, undefined> {
  const absolutePath = path.resolve(target)
  const stats = await fs.promises.stat(absolutePath)

  if (stats.isFile()) {
    let mtime = options.mtime
    let mode = options.mode

    if (options.preserveMtime === true) {
      mtime = dateToMtime(stats.mtime)
    }

    if (options.preserveMode === true) {
      mode = stats.mode
    }

    yield {
      path: path.basename(target),
      content: fs.createReadStream(absolutePath),
      mtime,
      mode
    }

    return
  }

  const dirName = path.basename(absolutePath)

  let pattern = '*'

  if (options.recursive === true) {
    pattern = '**/*'
  }

  for await (const content of globSource(target, pattern, {
    hidden: options.hidden,
    preserveMode: options.preserveMode,
    preserveMtime: options.preserveMtime,
    mode: options.mode,
    mtime: options.mtime
  })) {
    yield {
      ...content,
      path: `${dirName}${content.path}`
    }
  }
}
