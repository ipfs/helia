/**
 * @packageDocumentation
 *
 * `@helia/unixfs` is an implementation of a {@link https://github.com/ipfs/specs/blob/main/UNIXFS.md UnixFS filesystem} compatible with {@link https://github.com/ipfs/helia Helia}.
 *
 * See the [API docs](https://ipfs.github.io/helia/modules/_helia_unixfs.html) for all available operations.
 *
 * @example Creating files and directories
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * // create an empty dir and a file, then add the file to the dir
 * const emptyDirCid = await fs.addDirectory()
 * const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
 * const updateDirCid = await fs.cp(fileCid, emptyDirCid, 'foo.txt')
 *
 * // or doing the same thing as a stream
 * for await (const entry of fs.addAll([{
 *   path: 'foo.txt',
 *   content: Uint8Array.from([0, 1, 2, 3])
 * }])) {
 *   console.info(entry)
 * }
 * ```
 *
 * @example Recursively adding a directory
 *
 * Node.js-compatibly environments only:
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { globSource } from '@helia/unixfs'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * for await (const entry of fs.addAll(globSource('path/to/containing/dir', 'glob-pattern'))) {
 *   console.info(entry)
 * }
 * ```
 */

import { UnixFS as UnixFSClass } from './unixfs.js'
import type { GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Mtime, UnixFS as IPFSUnixFS } from 'ipfs-unixfs'
import type { ExporterProgressEvents, UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream, DirectoryCandidate, FileCandidate, ImportCandidateStream, ImporterOptions, ImporterProgressEvents, ImportResult } from 'ipfs-unixfs-importer'
import type { CID, Version } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface UnixFSComponents {
  blockstore: Pick<Blockstore, 'get' | 'put' | 'has'>
}

export type AddEvents = PutBlockProgressEvents
| ImporterProgressEvents

export interface AddOptions extends AbortOptions, Omit<ImporterOptions, 'onProgress'>, ProgressOptions<AddEvents> {

}

export type GetEvents = GetBlockProgressEvents
| ExporterProgressEvents

/**
 * Options to pass to the cat command
 */
export interface CatOptions extends AbortOptions, ProgressOptions<GetEvents> {
  /**
   * Start reading the file at this offset
   */
  offset?: number

  /**
   * Stop reading the file after this many bytes
   */
  length?: number

  /**
   * An optional path to allow reading files inside directories
   */
  path?: string

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the chmod command
 */
export interface ChmodOptions extends AbortOptions, ProgressOptions<GetEvents | PutBlockProgressEvents> {
  /**
   * If the target of the operation is a directory and this is true,
   * apply the new mode to all directory contents
   */
  recursive: boolean

  /**
   * Optional path to set the mode on directory contents
   */
  path?: string

  /**
   * DAGs with a root block larger than this value will be sharded. Blocks
   * smaller than this value will be regular UnixFS directories.
   */
  shardSplitThresholdBytes: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the cp command
 */
export interface CpOptions extends AbortOptions, ProgressOptions<GetEvents | PutBlockProgressEvents> {
  /**
   * If true, allow overwriting existing directory entries (default: false)
   */
  force: boolean

  /**
   * DAGs with a root block larger than this value will be sharded. Blocks
   * smaller than this value will be regular UnixFS directories.
   */
  shardSplitThresholdBytes: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the ls command
 */
export interface LsOptions extends AbortOptions, ProgressOptions<GetEvents> {
  /**
   * Optional path to list subdirectory contents if the target CID resolves to
   * a directory
   */
  path?: string

  /**
   * Start reading the directory entries at this offset
   */
  offset?: number

  /**
   * Stop reading the directory contents after this many directory entries
   */
  length?: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the mkdir command
 */
export interface MkdirOptions extends AbortOptions, ProgressOptions<GetEvents | PutBlockProgressEvents> {
  /**
   * The CID version to create the new directory with - defaults to the same
   * version as the containing directory
   */
  cidVersion: Version

  /**
   * If true, allow overwriting existing directory entries (default: false)
   */
  force: boolean

  /**
   * An optional mode to set on the new directory
   */
  mode?: number

  /**
   * An optional mtime to set on the new directory
   */
  mtime?: Mtime

  /**
   * DAGs with a root block larger than this value will be sharded. Blocks
   * smaller than this value will be regular UnixFS directories.
   */
  shardSplitThresholdBytes: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the rm command
 */
export interface RmOptions extends AbortOptions, ProgressOptions<GetEvents | PutBlockProgressEvents> {
  /**
   * DAGs with a root block larger than this value will be sharded. Blocks
   * smaller than this value will be regular UnixFS directories.
   */
  shardSplitThresholdBytes: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Options to pass to the stat command
 */
export interface StatOptions extends AbortOptions, ProgressOptions<GetEvents> {
  /**
   * An optional path to allow getting stats of paths inside directories
   */
  path?: string

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * Statistics relating to a UnixFS DAG
 */
export interface UnixFSStats {
  /**
   * The file or directory CID
   */
  cid: CID

  /**
   * The file or directory mode
   */
  mode?: number

  /**
   * The file or directory mtime
   */
  mtime?: Mtime

  /**
   * The size of the file in bytes
   */
  fileSize: bigint

  /**
   * The size of the DAG that holds the file in bytes
   */
  dagSize: bigint

  /**
   * How much of the file is in the local block store
   */
  localFileSize: bigint

  /**
   * How much of the DAG that holds the file is in the local blockstore
   */
  localDagSize: bigint

  /**
   * How many blocks make up the DAG - nb. this will only be accurate
   * if all blocks are present in the local blockstore
   */
  blocks: number

  /**
   * The type of file
   */
  type: 'file' | 'directory' | 'raw'

  /**
   * UnixFS metadata about this file or directory. Will not be present
   * if the node is a `raw` type.
   */
  unixfs?: IPFSUnixFS
}

/**
 * Options to pass to the touch command
 */
export interface TouchOptions extends AbortOptions, ProgressOptions<GetEvents | PutBlockProgressEvents> {
  /**
   * Optional mtime to set on the DAG root, defaults to the current time
   */
  mtime?: Mtime

  /**
   * Optional path to set mtime on directory contents
   */
  path?: string

  /**
   * If the DAG is a directory and this is true, update the mtime on all contents
   */
  recursive: boolean

  /**
   * DAGs with a root block larger than this value will be sharded. Blocks
   * smaller than this value will be regular UnixFS directories.
   */
  shardSplitThresholdBytes: number

  /**
   * If true, do not perform any network operations and throw if blocks are
   * missing from the local store. (default: false)
   */
  offline?: boolean
}

/**
 * The UnixFS interface provides familiar filesystem operations to make working with
 * UnixFS DAGs simple and intuitive.
 */
export interface UnixFS {
  /**
   * Add all files and directories from the passed stream. This method wraps the
   * `importer` export from the `ipfs-unixfs-importer` module - please see the docs
   * for input/output types.
   *
   * @example
   *
   * ```typescript
   * const source = [{
   *   path: './foo.txt',
   *   content: Uint8Array.from([0, 1, 2, 3])
   * }, {
   *   path: './bar.txt',
   *   content: Uint8Array.from([4, 5, 6, 7])
   * }]
   *
   * for await (const entry of fs.import(source)) {
   *   console.info(entry)
   * }
   * ```
   */
  addAll(source: ImportCandidateStream, options?: Partial<AddOptions>): AsyncIterable<ImportResult>

  /**
   * Add a single `Uint8Array` to your Helia node as a file.
   *
   * @example
   *
   * ```typescript
   * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   *
   * console.info(cid)
   * ```
   */
  addBytes(bytes: Uint8Array, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Add a stream of `Uint8Array` to your Helia node as a file.
   *
   * @example
   *
   * ```typescript
   * import fs from 'fs'
   *
   * const stream = fs.createReadStream('./foo.txt')
   * const cid = await fs.addByteStream(stream)
   *
   * console.info(cid)
   * ```
   */
  addByteStream(bytes: ByteStream, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Add a file to your Helia node with optional metadata.
   *
   * @example
   *
   * ```typescript
   * const cid = await fs.addFile({
   *   path: './foo.txt',
   *   content: Uint8Array.from([0, 1, 2, 3]),
   *   mode: 0x755,
   *   mtime: {
   *     secs: 10n,
   *     nsecs: 0
   *   }
   * })
   *
   * console.info(cid)
   * ```
   */
  addFile(file: FileCandidate, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Add a directory to your Helia node.
   *
   * @example
   *
   * ```typescript
   * const cid = await fs.addDirectory()
   *
   * console.info(cid)
   * ```
   */
  addDirectory(dir?: Partial<DirectoryCandidate>, options?: Partial<AddOptions>): Promise<CID>

  /**
   * Retrieve the contents of a file from your Helia node.
   *
   * @example
   *
   * ```typescript
   * for await (const buf of fs.cat(cid)) {
   *   console.info(buf)
   * }
   * ```
   */
  cat(cid: CID, options?: Partial<CatOptions>): AsyncIterable<Uint8Array>

  /**
   * Change the permissions on a file or directory in a DAG
   *
   * @example
   *
   * ```typescript
   * const beforeCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   * const beforeStats = await fs.stat(beforeCid)
   *
   * const afterCid = await fs.chmod(cid, 0x755)
   * const afterStats = await fs.stat(afterCid)
   *
   * console.info(beforeCid, beforeStats)
   * console.info(afterCid, afterStats)
   * ```
   */
  chmod(cid: CID, mode: number, options?: Partial<ChmodOptions>): Promise<CID>

  /**
   * Add a file or directory to a target directory.
   *
   * @example
   *
   * ```typescript
   * const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   * const directoryCid = await fs.addDirectory()
   *
   * const updatedCid = await fs.cp(fileCid, directoryCid, 'foo.txt')
   *
   * console.info(updatedCid)
   * ```
   */
  cp(source: CID, target: CID, name: string, options?: Partial<CpOptions>): Promise<CID>

  /**
   * List directory contents.
   *
   * @example
   *
   * ```typescript
   * for await (const entry of fs.ls(directoryCid)) {
   *   console.info(entry)
   * }
   * ```
   */
  ls(cid: CID, options?: Partial<LsOptions>): AsyncIterable<UnixFSEntry>

  /**
   * Make a new directory under an existing directory.
   *
   * @example
   *
   * ```typescript
   * const directoryCid = await fs.addDirectory()
   *
   * const updatedCid = await fs.mkdir(directoryCid, 'new-dir')
   *
   * console.info(updatedCid)
   * ```
   */
  mkdir(cid: CID, dirname: string, options?: Partial<MkdirOptions>): Promise<CID>

  /**
   * Remove a file or directory from an existing directory.
   *
   * @example
   *
   * ```typescript
   * const directoryCid = await fs.addDirectory()
   * const updatedCid = await fs.mkdir(directoryCid, 'new-dir')
   *
   * const finalCid = await fs.rm(updatedCid, 'new-dir')
   *
   * console.info(finalCid)
   * ```
   */
  rm(cid: CID, path: string, options?: Partial<RmOptions>): Promise<CID>

  /**
   * Return statistics about a UnixFS DAG.
   *
   * @example
   *
   * ```typescript
   * const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   *
   * const stats = await fs.stat(fileCid)
   *
   * console.info(stats)
   * ```
   */
  stat(cid: CID, options?: Partial<StatOptions>): Promise<UnixFSStats>

  /**
   * Update the mtime of a UnixFS DAG
   *
   * @example
   *
   * ```typescript
   * const beforeCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   * const beforeStats = await fs.stat(beforeCid)
   *
   * const afterCid = await fs.touch(beforeCid)
   * const afterStats = await fs.stat(afterCid)
   *
   * console.info(beforeCid, beforeStats)
   * console.info(afterCid, afterStats)
   * ```
   */
  touch(cid: CID, options?: Partial<TouchOptions>): Promise<CID>
}

/**
 * Create a {@link UnixFS} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function unixfs (helia: { blockstore: Pick<Blockstore, 'get' | 'put' | 'has'> }): UnixFS {
  return new UnixFSClass(helia)
}

export { globSource } from './utils/glob-source.js'
export type { GlobSourceResult, GlobSourceOptions } from './utils/glob-source.js'
export { urlSource } from './utils/url-source.js'
