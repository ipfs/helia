/**
 * @packageDocumentation
 *
 * `@helia/mfs` is an implementation of a {@link https://docs.ipfs.tech/concepts/file-systems/ Mutable File System} powered by {@link https://github.com/ipfs/helia Helia}.
 *
 * See the [API docs](https://ipfs.github.io/helia/modules/_helia_mfs.html) for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { mfs } from '@helia/mfs'
 *
 * const helia = await createHelia()
 * const fs = mfs(helia)
 *
 * // create an empty directory
 * await fs.mkdir('/my-directory')
 *
 * // add a file to the directory
 * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/my-directory/foo.txt')
 *
 * // read the file
 * for await (const buf of fs.cat('/my-directory/foo.txt')) {
 *   console.info(buf)
 * }
 * ```
 */

import { CID } from 'multiformats/cid'
import { MFS as MFSClass } from './mfs.js'
import type { AddOptions, CatOptions, ChmodOptions, CpOptions, LsOptions, MkdirOptions as UnixFsMkdirOptions, RmOptions as UnixFsRmOptions, StatOptions, TouchOptions, FileStats, DirectoryStats, RawStats, ExtendedStatOptions, ExtendedFileStats, ExtendedDirectoryStats, ExtendedRawStats } from '@helia/unixfs'
import type { ComponentLogger } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { Mtime } from 'ipfs-unixfs'
import type { UnixFSDirectoryEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream } from 'ipfs-unixfs-importer'

export interface MFSComponents {
  blockstore: Blockstore
  datastore: Datastore
  logger: ComponentLogger
}

export interface MFSInit {
  /**
   * The key used to store the root CID in the datastore (default: '/local/filesroot')
   */
  key?: string
}

export type WriteOptions = AddOptions & CpOptions & {
  /**
   * An optional mode to set on the new file
   */
  mode: number

  /**
   * An optional mtime to set on the new file
   */
  mtime: Mtime
}

export type MkdirOptions = AddOptions & StatOptions & CpOptions & UnixFsMkdirOptions

/**
 * Options to pass to the rm command
 */
export interface RmOptions extends UnixFsRmOptions {
  /**
   * If true, allow attempts to delete files or directories that do not exist
   * (default: false)
   */
  force: boolean
}

/**
 * The MFS interface allows working with files and directories in a mutable file
 * system.
 */
export interface MFS {
  /**
   * Add a single `Uint8Array` to your MFS as a file.
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   * ```
   */
  writeBytes(bytes: Uint8Array, path: string, options?: Partial<WriteOptions>): Promise<void>

  /**
   * Add a stream of `Uint8Array` to your MFS as a file.
   *
   * @example
   *
   * ```typescript
   * import fs from 'node:fs'
   *
   * const stream = fs.createReadStream('./foo.txt')
   * await fs.writeByteStream(stream, '/foo.txt')
   * ```
   */
  writeByteStream(bytes: ByteStream, path: string, options?: Partial<WriteOptions>): Promise<void>

  /**
   * Retrieve the contents of a file from your MFS.
   *
   * @example
   *
   * ```typescript
   * for await (const buf of fs.cat('/foo.txt')) {
   *   console.info(buf)
   * }
   * ```
   */
  cat(path: string, options?: Partial<CatOptions>): AsyncIterable<Uint8Array>

  /**
   * Change the permissions on a file or directory in your MFS
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   * const beforeStats = await fs.stat('/foo.txt')
   *
   * await fs.chmod('/foo.txt', 0x755)
   * const afterStats = await fs.stat('/foo.txt')
   *
   * console.info(beforeStats)
   * console.info(afterStats)
   * ```
   */
  chmod(path: string, mode: number, options?: Partial<ChmodOptions>): Promise<void>

  /**
   * Add a file or directory to a target directory in your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   * await fs.mkdir('/bar')
   *
   * await fs.cp('/foo.txt', '/bar')
   * ```
   *
   * Copy a file from one place to another in your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   *
   * await fs.cp('/foo.txt', '/bar.txt')
   * ```
   */
  cp(source: CID | string, destination: string, options?: Partial<CpOptions>): Promise<void>

  /**
   * List directory contents from your MFS.
   *
   * @example
   *
   * ```typescript
   * for await (const entry of fs.ls('/bar')) {
   *   console.info(entry)
   * }
   * ```
   */
  ls(path?: string, options?: Partial<LsOptions>): AsyncIterable<UnixFSDirectoryEntry>

  /**
   * Make a new directory in your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.mkdir('/new-dir')
   * ```
   */
  mkdir(path: string, options?: Partial<MkdirOptions>): Promise<void>

  /**
   * Remove a file or directory from your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.mkdir('/new-dir')
   * await fs.rm('/new-dir')
   * ```
   */
  rm(path: string, options?: Partial<RmOptions>): Promise<void>

  /**
   * Return statistics about a UnixFS DAG in your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   *
   * const stats = await fs.stat('/foo.txt')
   * console.info(stats)
   * ```
   */
  stat(path: string, options?: StatOptions): Promise<FileStats | DirectoryStats | RawStats>
  stat(path: string, options?: ExtendedStatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats>

  /**
   * Update the mtime of a UnixFS DAG in your MFS.
   *
   * @example
   *
   * ```typescript
   * await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), '/foo.txt')
   * const beforeStats = await fs.stat('/foo.txt')
   *
   * await fs.touch('/foo.txt')
   * const afterStats = await fs.stat(afterCid)
   *
   * console.info(beforeStats)
   * console.info(afterStats)
   * ```
   */
  touch(path: string, options?: Partial<TouchOptions>): Promise<void>
}

/**
 * Create a {@link MFS} instance powered by {@link https://github.com/ipfs/helia Helia}
 */
export function mfs (helia: { blockstore: Blockstore, datastore: Datastore, logger: ComponentLogger }, init: MFSInit = {}): MFS {
  return new MFSClass(helia, init)
}
