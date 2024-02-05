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
import type { AddOptions, CatOptions, ChmodOptions, CpOptions, LsOptions, MkdirOptions as UnixFsMkdirOptions, RmOptions as UnixFsRmOptions, StatOptions, TouchOptions, UnixFS, UnixFSStats } from '@helia/unixfs'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream } from 'ipfs-unixfs-importer'

const log = logger('helia:mfs')

export interface MFSComponents {
  blockstore: Blockstore
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
  ls(path?: string, options?: Partial<LsOptions>): AsyncIterable<UnixFSEntry>

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
  stat(path: string, options?: Partial<StatOptions>): Promise<UnixFSStats>

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
export function mfs (helia: { blockstore: Blockstore, datastore: Datastore }, init: MFSInit = {}): MFS {
  return new DefaultMFS(helia, init)
}
