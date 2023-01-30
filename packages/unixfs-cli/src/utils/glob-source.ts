import fsp from 'node:fs/promises'
import fs from 'node:fs'
import glob from 'it-glob'
import path from 'path'
import { CodeError } from '@libp2p/interfaces/errors'
import type { Mtime } from 'ipfs-unixfs'
import type { ImportCandidate } from 'ipfs-unixfs-importer'

export interface GlobSourceOptions {
  /**
   * Include .dot files in matched paths
   */
  hidden?: boolean

  /**
   * follow symlinks
   */
  followSymlinks?: boolean

  /**
   * Preserve mode
   */
  preserveMode?: boolean

  /**
   * Preserve mtime
   */
  preserveMtime?: boolean

  /**
   * mode to use - if preserveMode is true this will be ignored
   */
  mode?: number

  /**
   * mtime to use - if preserveMtime is true this will be ignored
   */
  mtime?: Mtime
}

/**
 * Create an async iterator that yields paths that match requested glob pattern
 */
export async function * globSource (cwd: string, pattern: string, options: GlobSourceOptions): AsyncGenerator<ImportCandidate> {
  options = options ?? {}

  if (typeof pattern !== 'string') {
    throw new CodeError('Pattern must be a string', 'ERR_INVALID_PATH', { pattern })
  }

  if (!path.isAbsolute(cwd)) {
    cwd = path.resolve(process.cwd(), cwd)
  }

  const globOptions = Object.assign({}, {
    nodir: false,
    realpath: false,
    absolute: true,
    dot: Boolean(options.hidden),
    follow: options.followSymlinks != null ? options.followSymlinks : true
  })

  for await (const p of glob(cwd, pattern, globOptions)) {
    const stat = await fsp.stat(p)

    let mode = options.mode

    if (options.preserveMode === true) {
      mode = stat.mode
    }

    let mtime = options.mtime

    if (options.preserveMtime === true) {
      const ms = stat.mtime.getTime()
      const secs = Math.floor(ms / 1000)

      mtime = {
        secs,
        nsecs: (ms - (secs * 1000)) * 1000
      }
    }

    yield {
      path: toPosix(p.replace(cwd, '')),
      content: stat.isFile() ? fs.createReadStream(p) : undefined,
      mode,
      mtime
    }
  }
}

function toPosix (path: string): string {
  return path.replace(/\\/g, '/')
}
