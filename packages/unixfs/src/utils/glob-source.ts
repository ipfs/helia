import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import Path from 'path'
import glob from 'it-glob'
import { InvalidParametersError } from '../errors.js'
import { toMtime } from './to-mtime.js'
import type { MtimeLike } from 'ipfs-unixfs'
import type { ImportCandidate } from 'ipfs-unixfs-importer'
import type { Options } from 'it-glob'

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
 *
 * @example
 *
 * ```ts
 * import { unixfs, globSource } from '@helia/unixfs'
 * import { createHelia } from 'helia'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * for await (const entry of fs.addAll(globSource(
 *  '/path/to/dir',
 *  '**\/*'
 * ), {
 *   wrapWithDirectory: true
 * })) {
 *   console.info(entry)
 * }
 * ```
 */
export async function * globSource (cwd: string, pattern: string, options: GlobSourceOptions = {}): AsyncGenerator<ImportCandidate & GlobSourceResult> {
  if (typeof pattern !== 'string') {
    throw new InvalidParametersError('Pattern must be a string')
  }

  if (!Path.isAbsolute(cwd)) {
    cwd = Path.resolve(process.cwd(), cwd)
  }

  if (os.platform() === 'win32') {
    cwd = toPosix(cwd)
  }

  const globOptions: Options = {
    onlyFiles: false,
    absolute: true,
    dot: Boolean(options.hidden),
    followSymbolicLinks: options.followSymlinks ?? true
  }

  for await (const p of glob(cwd, pattern, globOptions)) {
    // Workaround for https://github.com/micromatch/micromatch/issues/251
    if (Path.basename(p).startsWith('.') && options.hidden !== true) {
      continue
    }

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
      path: p.replace(cwd, ''),
      content: stat.isFile() ? fs.createReadStream(p) : undefined,
      mode,
      mtime: toMtime(mtime)
    }
  }
}

const toPosix = (path: string): string => path.replace(/\\/g, '/')
