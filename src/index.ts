import type { CID, Version } from 'multiformats/cid'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interfaces'
import { cat } from './commands/cat.js'
import { mkdir } from './commands/mkdir.js'
import type { Mtime } from 'ipfs-unixfs'
import { cp } from './commands/cp.js'
import { rm } from './commands/rm.js'
import { stat } from './commands/stat.js'
import { touch } from './commands/touch.js'
import { chmod } from './commands/chmod.js'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import { ls } from './commands/ls.js'

export interface UnixFSComponents {
  blockstore: Blockstore
}

export interface CatOptions extends AbortOptions {
  offset?: number
  length?: number
  path?: string
}

export interface ChmodOptions extends AbortOptions {
  recursive: boolean
  path?: string
  shardSplitThresholdBytes: number
}

export interface CpOptions extends AbortOptions {
  force: boolean
  shardSplitThresholdBytes: number
}

export interface LsOptions extends AbortOptions {
  path?: string
  offset?: number
  length?: number
}

export interface MkdirOptions extends AbortOptions {
  cidVersion: Version
  force: boolean
  mode?: number
  mtime?: Mtime
  shardSplitThresholdBytes: number
}

export interface RmOptions extends AbortOptions {
  shardSplitThresholdBytes: number
}

export interface StatOptions extends AbortOptions {
  path?: string
}

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
  unixfs?: import('ipfs-unixfs').UnixFS
}

export interface TouchOptions extends AbortOptions {
  mtime?: Mtime
  path?: string
  recursive: boolean
  shardSplitThresholdBytes: number
}

export interface UnixFS {
  cat: (cid: CID, options?: Partial<CatOptions>) => AsyncIterable<Uint8Array>
  chmod: (source: CID, mode: number, options?: Partial<ChmodOptions>) => Promise<CID>
  cp: (source: CID, target: CID, name: string, options?: Partial<CpOptions>) => Promise<CID>
  ls: (cid: CID, options?: Partial<LsOptions>) => AsyncIterable<UnixFSEntry>
  mkdir: (cid: CID, dirname: string, options?: Partial<MkdirOptions>) => Promise<CID>
  rm: (cid: CID, path: string, options?: Partial<RmOptions>) => Promise<CID>
  stat: (cid: CID, options?: Partial<StatOptions>) => Promise<UnixFSStats>
  touch: (cid: CID, options?: Partial<TouchOptions>) => Promise<CID>
}

class DefaultUnixFS implements UnixFS {
  private readonly components: UnixFSComponents

  constructor (components: UnixFSComponents) {
    this.components = components
  }

  async * cat (cid: CID, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
    yield * cat(cid, this.components.blockstore, options)
  }

  async chmod (source: CID, mode: number, options: Partial<ChmodOptions> = {}): Promise<CID> {
    return await chmod(source, mode, this.components.blockstore, options)
  }

  async cp (source: CID, target: CID, name: string, options: Partial<CpOptions> = {}): Promise<CID> {
    return await cp(source, target, name, this.components.blockstore, options)
  }

  async * ls (cid: CID, options: Partial<LsOptions> = {}): AsyncIterable<UnixFSEntry> {
    yield * ls(cid, this.components.blockstore, options)
  }

  async mkdir (cid: CID, dirname: string, options: Partial<MkdirOptions> = {}): Promise<CID> {
    return await mkdir(cid, dirname, this.components.blockstore, options)
  }

  async rm (cid: CID, path: string, options: Partial<RmOptions> = {}): Promise<CID> {
    return await rm(cid, path, this.components.blockstore, options)
  }

  async stat (cid: CID, options: Partial<StatOptions> = {}): Promise<UnixFSStats> {
    return await stat(cid, this.components.blockstore, options)
  }

  async touch (cid: CID, options: Partial<TouchOptions> = {}): Promise<CID> {
    return await touch(cid, this.components.blockstore, options)
  }
}

export function unixfs (helia: { blockstore: Blockstore }): UnixFS {
  return new DefaultUnixFS(helia)
}
