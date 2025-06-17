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
 *
 * @example Adding files and directories in the browser
 *
 * Uses [@cypsela/browser-source](https://github.com/cypsela/browser-source) to read [FileSystemEntry](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry) and [FileSystemHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle) files and directories.
 *
 * Instances of these data types are available from drag and drop events and window methods like [showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker).
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { fsEntrySource, fsHandleSource } from '@cypsela/browser-source'
 *
 * const helia = await createHelia()
 * const fs = unixfs(helia)
 *
 * // get FileSystemEntry from drag and drop events
 * const fileEntry = {} as FileSystemEntry
 *
 * for await (const entry of fs.addAll(fsEntrySource(fileEntry))) {
 *   console.info(entry)
 * }
 *
 * // get FileSystemHandle from drag and drop events or window methods
 * const fileHandle = {} as FileSystemHandle
 *
 * for await (const entry of fs.addAll(fsHandleSource(fileHandle))) {
 *   console.info(entry)
 * }
 * ```
 */

import { UnixFS as UnixFSClass } from './unixfs.js'
import type { GetBlockProgressEvents, PutBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
import type { Blockstore } from 'interface-blockstore'
import type { Mtime, UnixFS as IPFSUnixFS } from 'ipfs-unixfs'
import type { ExporterProgressEvents, UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream, DirectoryCandidate, ImportCandidateStream, ImporterOptions, ImporterProgressEvents, ImportResult, ImportContent } from 'ipfs-unixfs-importer'
import type { CID, Version } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface UnixFSComponents {
  blockstore: Pick<Blockstore, 'get' | 'put' | 'has'>
}

export interface FileCandidate<T extends ImportContent = ImportContent> {
  path: string
  content: T
  mtime?: Mtime
  mode?: number
}

export type AddEvents = PutBlockProgressEvents
| ImporterProgressEvents

export interface AddOptions extends AbortOptions, Omit<ImporterOptions, 'onProgress'>, ProgressOptions<AddEvents> {

}

export type AddFileOptions = Omit<AddOptions, 'wrapWithDirectory'>

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
   * missing from the local store.
   *
   * @default false
   */
  offline?: boolean
}

export interface ExtendedStatOptions extends StatOptions {
  /**
   * If true, traverse the whole DAG to return additional stats. If all data is
   * not in the local blockstore, this may involve fetching them from the
   * network.
   */
  extended: true

  /**
   * By default CIDs are deduplicated using a `ScalableCuckooFilter` - if you
   * wish to use a different filter, pass it here.
   */
  filter?: Filter
}

/**
 * Statistics relating to a UnixFS DAG
 */
export interface Stats {
  /**
   * The file or directory CID
   */
  cid: CID

  /**
   * The file or directory mode
   */
  mode: number

  /**
   * The file or directory mtime
   */
  mtime?: Mtime

  /**
   * The type of UnixFS node - 'file' or 'directory'
   */
  type: 'file' | 'directory' | 'raw'

  /**
   * UnixFS metadata about this file or directory
   */
  unixfs?: IPFSUnixFS

  /**
   * The size in bytes of the file as reported by the UnixFS metadata stored in
   * the root DAG node, or if the CID resolves to a raw node, the size of the
   * block that holds it.
   *
   * For directories this will return `0` as no size information is available in
   * the root block - instead please stat with the `extended` option to traverse
   * the DAG and calculate the size.
   */
  size: bigint
}

export interface FileStats extends Stats {
  type: 'file'
  unixfs: IPFSUnixFS
}

export interface DirectoryStats extends Stats {
  type: 'directory'
  unixfs: IPFSUnixFS
}

export interface RawStats extends Stats {
  type: 'raw'
  unixfs: undefined
}

/**
 * More detailed statistics relating to a UnixFS DAG. These can involve
 * traversing the DAG behind the CID so can involve network operations and/or
 * more disk activity.
 */
export interface ExtendedStats extends Stats {
  /**
   * How many blocks make up the DAG.
   *
   * nb. this will only be accurate if either all blocks are present in the
   * local blockstore or the `offline` option was not `true`
   */
  blocks: bigint

  /**
   * How many unique blocks make up the DAG - this count does not include any
   * blocks that appear in the DAG more than once.
   *
   * nb. this will only be accurate if either all blocks are present in the
   * local blockstore or the `offline` option was not `true`
   */
  uniqueBlocks: bigint

  /**
   * The size of the DAG that holds the file or directory in bytes - this is
   * the sum of all block sizes so includes any protobuf overhead, etc.
   *
   * Duplicate blocks are included in this measurement.
   *
   * nb. this will only be accurate if either all blocks are present in the
   * local blockstore or the `offline` option was not `true`
   */
  dagSize: bigint

  /**
   * Similar to `dagSize` except duplicate blocks are not included in the
   * reported amount.
   *
   * nb. this will only be accurate if either all blocks are present in the
   * local blockstore or the `offline` option was not `true`
   */
  deduplicatedDagSize: bigint

  /**
   * How much of the file or directory is in the local block store. If this is a
   * directory it will include the `localSize` of all child files and
   * directories.
   *
   * It does not include protobuf overhead, for that see `dagSize`.
   *
   * nb. if the `offline` option is `true`, and not all blocks for the
   * file/directory are in the blockstore, this number may be smaller than
   * `size`.
   */
  localSize: bigint
}

export interface ExtendedFileStats extends ExtendedStats {
  type: 'file'
  unixfs: IPFSUnixFS
}

export interface ExtendedDirectoryStats extends ExtendedStats {
  type: 'directory'
  unixfs: IPFSUnixFS
}

export interface ExtendedRawStats extends ExtendedStats {
  type: 'raw'
  unixfs: undefined
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
   * Add a single `Uint8Array` to your Helia node and receive a CID that will
   * resolve to it.
   *
   * If you want to preserve a file name or other metadata such as modification
   * time or mode, use `addFile` instead.
   *
   * @example
   *
   * ```typescript
   * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]))
   *
   * console.info(cid)
   * ```
   */
  addBytes(bytes: Uint8Array, options?: Partial<AddFileOptions>): Promise<CID>

  /**
   * Add a stream of `Uint8Array`s to your Helia node and receive a CID that
   * will resolve to them.
   *
   * If you want to preserve a file name or other metadata such as modification
   * time or mode, use `addFile` instead.
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
  addByteStream(bytes: ByteStream, options?: Partial<AddFileOptions>): Promise<CID>

  /**
   * Add a file to your Helia node with metadata. The returned CID will resolve
   * to a directory with one file entry.
   *
   * If you don't care about file names and just want a CID that will resolve to
   * the contents of the file, use `addBytes` or `addByeStream` instead.
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
  addFile(file: FileCandidate, options?: Partial<AddFileOptions>): Promise<CID>

  /**
   * Add a directory to your Helia node.
   *
   * @example
   *
   * If no path is specified, the returned CID will resolve to an empty
   * directory.
   *
   * ```typescript
   * const cid = await fs.addDirectory()
   *
   * console.info(cid) // empty directory CID
   * ```
   *
   * @example
   *
   * If a path is specified, the CID will resolve to a directory that contains
   * an empty directory with the specified name.
   *
   * ```typescript
   * const cid = await fs.addDirectory({
   *   path: 'my-dir'
   * })
   *
   * console.info(cid) // containing directory CID
   *
   * const stat = await fs.stat(cid, {
   *   path: 'my-dir'
   * })
   *
   * console.info(stat.cid) // empty directory CID
   * ```
   */
  addDirectory(dir?: Partial<DirectoryCandidate>, options?: Partial<AddFileOptions>): Promise<CID>

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
  stat(cid: CID, options?: StatOptions): Promise<FileStats | DirectoryStats | RawStats>
  stat(cid: CID, options?: ExtendedStatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats>

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
