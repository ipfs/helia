/**
 * @packageDocumentation
 *
 * `@helia/mfs` is an implementation of a {@link https://docs.ipfs.tech/concepts/file-systems/ Mutable File System} powered by {@link https://github.com/ipfs/helia Helia}.
 *
 * See the {@link MFS MFS interface} for all available operations.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { mfs } from '@helia/mfs'
 *
 * const helia = createHelia({
 *   // ... helia config
 * })
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

import { unixfs } from '@helia/unixfs'
import { AlreadyExistsError, DoesNotExistError, InvalidParametersError, NotADirectoryError } from '@helia/unixfs/errors'
import { logger } from '@libp2p/logger'
import { Key } from 'interface-datastore'
import { UnixFS as IPFSUnixFS, type Mtime } from 'ipfs-unixfs'
import { CID } from 'multiformats/cid'
import { basename } from './utils/basename.js'
import type { Blocks } from '@helia/interface/blocks'
import type { AddOptions, CatOptions, ChmodOptions, CpOptions, LsOptions, MkdirOptions as UnixFsMkdirOptions, RmOptions as UnixFsRmOptions, StatOptions, TouchOptions, UnixFS, UnixFSStats } from '@helia/unixfs'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Datastore } from 'interface-datastore'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream } from 'ipfs-unixfs-importer'

const log = logger('helia:mfs')

export interface MFSComponents {
  blockstore: Blocks
  datastore: Datastore
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
  writeBytes: (bytes: Uint8Array, path: string, options?: Partial<WriteOptions>) => Promise<void>

  /**
   * Add a stream of `Uint8Array` to your Helia node as a file.
   *
   * @example
   *
   * ```typescript
   * import fs from 'node:fs'
   *
   * const stream = fs.createReadStream('./foo.txt')
   * const cid = await fs.addByteStream(stream)
   *
   * console.info(cid)
   * ```
   */
  writeByteStream: (bytes: ByteStream, path: string, options?: Partial<WriteOptions>) => Promise<void>

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
  cat: (path: string, options?: Partial<CatOptions>) => AsyncIterable<Uint8Array>

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
  chmod: (path: string, mode: number, options?: Partial<ChmodOptions>) => Promise<void>

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
  cp: (source: CID | string, destination: string, options?: Partial<CpOptions>) => Promise<void>

  /**
   * List directory contents.
   *
   * @example
   *
   * ```typescript
   * for await (const entry of fs.ls(directoryCid)) {
   *   console.info(etnry)
   * }
   * ```
   */
  ls: (path?: string, options?: Partial<LsOptions>) => AsyncIterable<UnixFSEntry>

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
  mkdir: (path: string, options?: Partial<MkdirOptions>) => Promise<void>

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
  rm: (path: string, options?: Partial<RmOptions>) => Promise<void>

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
  stat: (path: string, options?: Partial<StatOptions>) => Promise<UnixFSStats>

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
  touch: (path: string, options?: Partial<TouchOptions>) => Promise<void>
}

interface PathEntry {
  cid: CID
  name: string
  unixfs?: IPFSUnixFS
}

interface WalkPathOptions extends AbortOptions {
  createMissingDirectories: boolean
  finalSegmentMustBeDirectory: boolean
}

class DefaultMFS implements MFS {
  private readonly components: MFSComponents
  private readonly unixfs: UnixFS
  private root?: CID
  private readonly key: Key

  constructor (components: MFSComponents, init: MFSInit = {}) {
    this.components = components

    this.key = new Key(init.key ?? '/locals/filesroot')
    this.unixfs = unixfs(components)
  }

  async #getRootCID (): Promise<CID> {
    if (this.root == null) {
      try {
        const buf = await this.components.datastore.get(this.key)
        this.root = CID.decode(buf)
      } catch (err: any) {
        if (err.code !== 'ERR_NOT_FOUND') {
          throw err
        }

        this.root = await this.unixfs.addDirectory()
      }
    }

    return this.root
  }

  async writeBytes (bytes: Uint8Array, path: string, options?: Partial<WriteOptions>): Promise<void> {
    const cid = await this.unixfs.addFile({
      content: bytes,
      mode: options?.mode,
      mtime: options?.mtime
    }, options)

    await this.cp(cid, path, options)
  }

  async writeByteStream (bytes: ByteStream, path: string, options?: Partial<WriteOptions>): Promise<void> {
    const cid = await this.unixfs.addFile({
      content: bytes,
      mode: options?.mode,
      mtime: options?.mtime
    }, options)

    await this.cp(cid, path, options)
  }

  async * cat (path: string, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
    const root = await this.#getRootCID()
    const trail = await this.#walkPath(root, path, {
      ...options,
      createMissingDirectories: false,
      finalSegmentMustBeDirectory: false
    })

    yield * this.unixfs.cat(trail[trail.length - 1].cid, options)
  }

  async chmod (path: string, mode: number, options: Partial<ChmodOptions> = {}): Promise<void> {
    const root = await this.#getRootCID()

    this.root = await this.unixfs.chmod(root, mode, {
      ...options,
      path
    })
  }

  async cp (source: CID | string, destination: string, options?: Partial<CpOptions>): Promise<void> {
    const root = await this.#getRootCID()
    const force = options?.force ?? false

    if (typeof source === 'string') {
      const stat = await this.stat(source, options)

      source = stat.cid
    }

    if (!force) {
      await this.#ensurePathDoesNotExist(destination, options)
    }

    const fileName = basename(destination)
    const containingDirectory = destination.substring(0, destination.length - `/${fileName}`.length)

    let trail: PathEntry[] = [{
      cid: root,
      name: ''
    }]

    if (containingDirectory !== '') {
      trail = await this.#walkPath(root, containingDirectory, {
        ...options,
        createMissingDirectories: options?.force ?? false,
        finalSegmentMustBeDirectory: true
      })
    }

    trail.push({
      cid: source,
      name: fileName
    })

    this.root = await this.#persistPath(trail, options)
  }

  async * ls (path?: string, options?: Partial<LsOptions>): AsyncIterable<UnixFSEntry> {
    const root = await this.#getRootCID()

    if (options?.path != null) {
      path = `${path}/${options.path}`
    }

    yield * this.unixfs.ls(root, {
      ...options,
      path
    })
  }

  async mkdir (path: string, options?: Partial<MkdirOptions>): Promise<void> {
    const force = options?.force ?? false

    if (!force) {
      await this.#ensurePathDoesNotExist(path, options)
    }

    const dirName = basename(path)
    const containingDirectory = path.substring(0, path.length - `/${dirName}`.length)
    const root = await this.#getRootCID()

    let trail: PathEntry[] = [{
      cid: root,
      name: ''
    }]

    if (containingDirectory !== '') {
      trail = await this.#walkPath(root, containingDirectory, {
        ...options,
        createMissingDirectories: force,
        finalSegmentMustBeDirectory: true
      })
    }

    trail.push({
      cid: await this.unixfs.addDirectory({
        mode: options?.mode,
        mtime: options?.mtime
      }, options),
      name: basename(path)
    })

    this.root = await this.#persistPath(trail, options)
  }

  async rm (path: string, options?: Partial<RmOptions>): Promise<void> {
    const force = options?.force ?? false

    if (!force) {
      await this.#ensurePathExists(path, options)
    }

    const root = await this.#getRootCID()

    const trail = await this.#walkPath(root, path, {
      ...options,
      createMissingDirectories: false,
      finalSegmentMustBeDirectory: false
    })

    const lastSegment = trail.pop()

    if (lastSegment == null) {
      throw new InvalidParametersError('path was too short')
    }

    // remove directory entry
    const containingDir = trail[trail.length - 1]
    containingDir.cid = await this.unixfs.rm(containingDir.cid, lastSegment.name, options)

    this.root = await this.#persistPath(trail, options)
  }

  async stat (path: string, options?: Partial<StatOptions>): Promise<UnixFSStats> {
    const root = await this.#getRootCID()

    const trail = await this.#walkPath(root, path, {
      ...options,
      createMissingDirectories: false,
      finalSegmentMustBeDirectory: false
    })

    const finalEntry = trail.pop()

    if (finalEntry == null) {
      throw new DoesNotExistError()
    }

    return this.unixfs.stat(finalEntry.cid, {
      ...options
    })
  }

  async touch (path: string, options?: Partial<TouchOptions>): Promise<void> {
    const root = await this.#getRootCID()
    const trail = await this.#walkPath(root, path, {
      ...options,
      createMissingDirectories: false,
      finalSegmentMustBeDirectory: false
    })

    const finalEntry = trail[trail.length - 1]

    if (finalEntry == null) {
      throw new DoesNotExistError()
    }

    finalEntry.cid = await this.unixfs.touch(finalEntry.cid, options)

    this.root = await this.#persistPath(trail, options)
  }

  async #walkPath (root: CID, path: string, opts: WalkPathOptions): Promise<PathEntry[]> {
    if (!path.startsWith('/')) {
      throw new InvalidParametersError('path must be absolute')
    }

    const stat = await this.unixfs.stat(root, {
      ...opts,
      offline: true
    })

    const output: PathEntry[] = [{
      cid: root,
      name: '',
      unixfs: stat.unixfs
    }]

    let cid = root
    const parts = path.split('/').filter(Boolean)

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i]

      try {
        const stat = await this.unixfs.stat(cid, {
          ...opts,
          offline: true,
          path: segment
        })

        output.push({
          cid: stat.cid,
          name: segment,
          unixfs: stat.unixfs
        })

        cid = stat.cid
      } catch (err) {
        log.error('could not resolve path segment %s of %s under %c', segment, path, root)

        if (opts.createMissingDirectories) {
          const cid = await this.unixfs.addDirectory()

          output.push({
            cid,
            name: segment,
            unixfs: new IPFSUnixFS({ type: 'directory' })
          })
        } else {
          throw new DoesNotExistError(`${path} does not exist`)
        }
      }
    }

    const lastSegment = output[output.length - 1]

    if (opts.finalSegmentMustBeDirectory && lastSegment.unixfs?.isDirectory() !== true) {
      throw new NotADirectoryError(`${path} was not a directory`)
    }

    return output
  }

  async #persistPath (path: PathEntry[], options: Partial<CpOptions> = {}): Promise<CID> {
    let child = path.pop()

    if (child == null) {
      throw new InvalidParametersError('path was too short')
    }

    let cid = child.cid

    for (let i = path.length - 1; i > -1; i--) {
      const segment = path[i]
      segment.cid = await this.unixfs.cp(child.cid, segment.cid, child.name, {
        ...options,
        force: true
      })

      child = segment
      cid = segment.cid
    }

    await this.components.datastore.put(this.key, cid.bytes, options)

    return cid
  }

  async #ensurePathExists (path: string, options: StatOptions = {}): Promise<void> {
    const exists = await this.#pathExists(path, options)

    if (!exists) {
      throw new DoesNotExistError()
    }
  }

  async #ensurePathDoesNotExist (path: string, options: StatOptions = {}): Promise<void> {
    const exists = await this.#pathExists(path, options)

    if (exists) {
      throw new AlreadyExistsError()
    }
  }

  async #pathExists (path: string, options: StatOptions = {}): Promise<boolean> {
    try {
      await this.stat(path, {
        ...options,
        offline: true
      })

      return true
    } catch {
      return false
    }
  }
}

/**
 * Create a {@link MFS} instance powered by {@link https://github.com/ipfs/helia Helia}
 */
export function mfs (helia: { blockstore: Blocks, datastore: Datastore }, init: MFSInit = {}): MFS {
  return new DefaultMFS(helia, init)
}
