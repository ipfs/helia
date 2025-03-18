import * as dagPb from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { exporter, type RawNode, type UnixFSDirectory, type UnixFSFile } from 'ipfs-unixfs-exporter'
import mergeOpts from 'merge-options'
import * as raw from 'multiformats/codecs/raw'
import { InvalidPBNodeError, NotUnixFSError, UnknownError } from '../errors.js'
import { resolve } from './utils/resolve.js'
import type { ExtendedStatOptions, ExtendedDirectoryStats, ExtendedFileStats, StatOptions, DirectoryStats, FileStats, RawStats, ExtendedRawStats } from '../index.js'
import type { GetStore, HasStore } from '../unixfs.js'
import type { CID } from 'multiformats/cid'

// https://github.com/ipfs/specs/blob/main/UNIXFS.md#metadata
const DEFAULT_DIR_MODE = 0x755
const DEFAULT_FILE_MODE = 0x644

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:stat')

const defaultOptions: StatOptions = {

}

export async function stat (cid: CID, blockstore: GetStore & HasStore, options?: StatOptions): Promise<FileStats | DirectoryStats | RawStats>
export async function stat (cid: CID, blockstore: GetStore & HasStore, options?: ExtendedStatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats | ExtendedRawStats>
export async function stat (cid: CID, blockstore: GetStore & HasStore, options: Partial<ExtendedStatOptions> = {}): Promise<any> {
  const opts: StatOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, options.path, blockstore, opts)

  log('stat %c', resolved.cid)

  const result = await exporter(resolved.cid, blockstore, opts)

  if (result.type === 'raw') {
    if (options.extended === true) {
      return createExtendedRawStats(result)
    }

    return createRawStats(result)
  } else if (result.type === 'file' || result.type === 'directory') {
    if (options.extended === true) {
      return createExtendedStats(result, blockstore, options)
    }

    return createStats(result)
  }

  throw new NotUnixFSError()
}

function createStats (entry: UnixFSFile | UnixFSDirectory): FileStats | DirectoryStats {
  return {
    type: entry.type,
    cid: entry.cid,
    unixfs: entry.unixfs,
    mode: entry.unixfs.mode ?? (entry.unixfs.isDirectory() ? DEFAULT_DIR_MODE : DEFAULT_FILE_MODE),
    mtime: entry.unixfs.mtime,
    size: entry.unixfs.fileSize()
  }
}

async function createExtendedStats (entry: UnixFSFile | UnixFSDirectory, blockstore: GetStore & HasStore, options: StatOptions): Promise<ExtendedFileStats | ExtendedDirectoryStats> {
  const stats = await inspectDag(entry.cid, blockstore, options)

  return {
    type: entry.type,
    cid: entry.cid,
    unixfs: entry.unixfs,
    size: entry.unixfs.isDirectory() ? stats.localSize : entry.unixfs.fileSize(),
    mode: entry.unixfs.mode ?? (entry.unixfs.isDirectory() ? DEFAULT_DIR_MODE : DEFAULT_FILE_MODE),
    mtime: entry.unixfs.mtime,
    ...stats
  }
}

function createRawStats (entry: RawNode): RawStats {
  return {
    type: entry.type,
    cid: entry.cid,
    unixfs: undefined,
    mode: DEFAULT_FILE_MODE,
    mtime: undefined,
    size: BigInt(entry.node.byteLength)
  }
}

function createExtendedRawStats (entry: RawNode): ExtendedRawStats {
  return {
    type: entry.type,
    cid: entry.cid,
    unixfs: undefined,
    mode: DEFAULT_FILE_MODE,
    mtime: undefined,
    size: BigInt(entry.node.byteLength),
    localSize: BigInt(entry.node.byteLength),
    dagSize: BigInt(entry.node.byteLength),
    blocks: 1n
  }
}

interface InspectDagResults {
  localSize: bigint
  dagSize: bigint
  blocks: bigint
}

async function inspectDag (cid: CID, blockstore: GetStore & HasStore, options: StatOptions): Promise<InspectDagResults> {
  const results: InspectDagResults = {
    localSize: 0n,
    dagSize: 0n,
    blocks: 0n
  }

  try {
    const block = await blockstore.get(cid, options)
    results.blocks++
    results.dagSize += BigInt(block.byteLength)

    if (cid.code === raw.code) {
      results.localSize += BigInt(block.byteLength)
    } else if (cid.code === dagPb.code) {
      const pbNode = dagPb.decode(block)

      if (pbNode.Links.length > 0) {
        // intermediate node
        for (const link of pbNode.Links) {
          const linkResult = await inspectDag(link.Hash, blockstore, options)

          results.localSize += linkResult.localSize
          results.dagSize += linkResult.dagSize
          results.blocks += linkResult.blocks
        }
      } else {
        // leaf node
        if (pbNode.Data == null) {
          throw new InvalidPBNodeError(`PBNode ${cid.toString()} had no data`)
        }

        const unixfs = UnixFS.unmarshal(pbNode.Data)

        if (unixfs.data != null) {
          results.localSize += BigInt(unixfs.data.byteLength ?? 0)
        }
      }
    } else {
      throw new UnknownError(`${cid.toString()} was neither DAG_PB nor RAW`)
    }
  } catch (err: any) {
    if (err.name !== 'NotFoundError' || options.offline !== true) {
      throw err
    }
  }

  return results
}
