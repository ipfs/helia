import { addAll, addBytes, addByteStream, addDirectory, addFile } from './commands/add.js'
import { cat } from './commands/cat.js'
import { chmod } from './commands/chmod.js'
import { cp } from './commands/cp.js'
import { ls } from './commands/ls.js'
import { mkdir } from './commands/mkdir.js'
import { rm } from './commands/rm.js'
import { stat } from './commands/stat.js'
import { touch } from './commands/touch.js'
import type { AddOptions, CatOptions, ChmodOptions, CpOptions, ExtendedStatOptions, ExtendedDirectoryStats, ExtendedFileStats, FileCandidate, LsOptions, MkdirOptions, RmOptions, StatOptions, TouchOptions, UnixFSComponents, DirectoryStats, FileStats, UnixFS as UnixFSInterface, RawStats, ExtendedRawStats } from './index.js'
import type { Blockstore } from 'interface-blockstore'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { ByteStream, DirectoryCandidate, ImportCandidateStream, ImportResult } from 'ipfs-unixfs-importer'
import type { CID } from 'multiformats/cid'

export type PutStore = Pick<Blockstore, 'put'>
export type GetStore = Pick<Blockstore, 'get'>
export type HasStore = Pick<Blockstore, 'has'>

export class UnixFS implements UnixFSInterface {
  private readonly components: UnixFSComponents

  constructor (components: UnixFSComponents) {
    this.components = components
  }

  async * addAll (source: ImportCandidateStream, options: Partial<AddOptions> = {}): AsyncIterable<ImportResult> {
    yield * addAll(source, this.components.blockstore, options)
  }

  async addBytes (bytes: Uint8Array, options: Partial<AddOptions> = {}): Promise<CID> {
    return addBytes(bytes, this.components.blockstore, options)
  }

  async addByteStream (bytes: ByteStream, options: Partial<AddOptions> = {}): Promise<CID> {
    return addByteStream(bytes, this.components.blockstore, options)
  }

  async addFile (file: FileCandidate, options: Partial<AddOptions> = {}): Promise<CID> {
    return addFile(file, this.components.blockstore, options)
  }

  async addDirectory (dir: Partial<DirectoryCandidate> = {}, options: Partial<AddOptions> = {}): Promise<CID> {
    return addDirectory(dir, this.components.blockstore, options)
  }

  async * cat (cid: CID, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
    yield * cat(cid, this.components.blockstore, options)
  }

  async chmod (cid: CID, mode: number, options: Partial<ChmodOptions> = {}): Promise<CID> {
    return chmod(cid, mode, this.components.blockstore, options)
  }

  async cp (source: CID, target: CID, name: string, options: Partial<CpOptions> = {}): Promise<CID> {
    return cp(source, target, name, this.components.blockstore, options)
  }

  async * ls (cid: CID, options: Partial<LsOptions> = {}): AsyncIterable<UnixFSEntry> {
    yield * ls(cid, this.components.blockstore, options)
  }

  async mkdir (cid: CID, dirname: string, options: Partial<MkdirOptions> = {}): Promise<CID> {
    return mkdir(cid, dirname, this.components.blockstore, options)
  }

  async rm (cid: CID, path: string, options: Partial<RmOptions> = {}): Promise<CID> {
    return rm(cid, path, this.components.blockstore, options)
  }

  async stat (cid: CID, options?: StatOptions): Promise<FileStats | DirectoryStats | RawStats>
  async stat (cid: CID, options?: ExtendedStatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats>
  async stat (cid: CID, options: Partial<StatOptions> = {}): Promise<FileStats | DirectoryStats | RawStats> {
    return stat(cid, this.components.blockstore, options)
  }

  async touch (cid: CID, options: Partial<TouchOptions> = {}): Promise<CID> {
    return touch(cid, this.components.blockstore, options)
  }
}
