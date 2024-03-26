import fs from 'fs'
import fsp from 'fs/promises'
import Path from 'path'
import glob from 'it-glob'
import { InvalidParametersError } from '../errors.js'
import { toMtime } from './to-mtime.js'
import type { MtimeLike } from 'ipfs-unixfs'
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
  mtime?: MtimeLike
}

export interface GlobSourceResult {
  path: string
  content: AsyncIterable<Uint8Array> | undefined
  mode: number | undefined
  mtime: MtimeLike | undefined
}

/**
 * Create an async iterator that yields paths that match requested glob pattern
 */
export async function * globSource (cwd: string, pattern: string, options: GlobSourceOptions = {}): AsyncGenerator<ImportCandidate & GlobSourceResult> {
  if (typeof pattern !== 'string') {
    throw new InvalidParametersError('Pattern must be a string')
  }

  if (!Path.isAbsolute(cwd)) {
    cwd = Path.resolve(process.cwd(), cwd)
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
      mtime = stat.mtime
    }

    yield {
      path: toPosix(p.replace(cwd, '')),
      content: stat.isFile() ? fs.createReadStream(p) : undefined,
      mode,
      mtime: toMtime(mtime)
    }
  }
}

const toPosix = (path: string): string => path.replace(/\\/g, '/')
