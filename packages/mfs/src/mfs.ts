import { unixfs } from '@helia/unixfs'
import { AlreadyExistsError, DoesNotExistError, InvalidParametersError, NotADirectoryError } from '@helia/unixfs/errors'
import { Key } from 'interface-datastore'
import { UnixFS as IPFSUnixFS } from 'ipfs-unixfs'
import map from 'it-map'
import { CID } from 'multiformats/cid'
import { basename } from './utils/basename.js'
import type { MFSComponents, MFSInit, MFS as MFSInterface, MkdirOptions, RmOptions, WriteOptions } from './index.js'
import type { CatOptions, ChmodOptions, CpOptions, LsOptions, StatOptions, TouchOptions, UnixFS, FileStats, DirectoryStats, RawStats, ExtendedStatOptions, ExtendedFileStats, ExtendedDirectoryStats, ExtendedRawStats } from '@helia/unixfs'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { UnixFSDirectoryEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream } from 'ipfs-unixfs-importer'

interface PathEntry {
  cid: CID
  name: string
  unixfs?: IPFSUnixFS
}

interface WalkPathOptions extends AbortOptions {
  createMissingDirectories: boolean
  finalSegmentMustBeDirectory: boolean
}

export class MFS implements MFSInterface {
  private readonly components: MFSComponents
  private readonly unixfs: UnixFS
  private root?: CID
  private readonly key: Key
  private readonly log: Logger

  constructor (components: MFSComponents, init: MFSInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('helia:mfs')

    // spellchecker:disable-next-line
    this.key = new Key(init.key ?? '/locals/filesroot')
    this.unixfs = unixfs(components)
  }

  async #getRootCID (): Promise<CID> {
    if (this.root == null) {
      try {
        const buf = await this.components.datastore.get(this.key)
        this.root = CID.decode(buf)
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err
        }

        this.root = await this.unixfs.addDirectory()
      }
    }

    return this.root
  }

  async writeBytes (bytes: Uint8Array, path: string, options?: Partial<WriteOptions>): Promise<void> {
    const cid = await this.unixfs.addBytes(bytes, options)

    await this.cp(cid, path, options)

    if (options?.mode != null) {
      await this.chmod(path, options.mode, options)
    }

    if (options?.mtime != null) {
      await this.touch(path, options)
    }
  }

  async writeByteStream (bytes: ByteStream, path: string, options?: Partial<WriteOptions>): Promise<void> {
    const cid = await this.unixfs.addByteStream(bytes, options)

    await this.cp(cid, path, options)

    if (options?.mode != null) {
      await this.chmod(path, options.mode, options)
    }

    if (options?.mtime != null) {
      await this.touch(path, options)
    }
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

  async * ls (path?: string, options?: Partial<LsOptions>): AsyncIterable<UnixFSDirectoryEntry> {
    const root = await this.#getRootCID()

    if (options?.path != null) {
      path = `${path}/${options.path}`
    }

    const rootString = root.toString()

    yield * map(this.unixfs.ls(root, {
      ...options,
      path
    }), (file) => {
      // remove CID from start of path
      let filePath = file.path.split('/').slice(1).join('/')

      if (filePath.startsWith(rootString)) {
        filePath = filePath.substring(0, rootString.length)
      }

      return {
        ...file,
        path: `${path === '/' ? '' : path}/${filePath}`
      }
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

  async stat (path: string, options?: StatOptions): Promise<FileStats | DirectoryStats | RawStats>
  async stat (path: string, options?: ExtendedStatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats>
  async stat (path: string, options?: StatOptions | ExtendedStatOptions): Promise<FileStats | DirectoryStats | RawStats | ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats> {
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

    return this.unixfs.stat(finalEntry.cid, options)
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
        this.log.error('could not resolve path segment %s of %s under %c', segment, path, root)

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
