import * as dagPb from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { exporter } from 'ipfs-unixfs-exporter'
import mergeOpts from 'merge-options'
import * as raw from 'multiformats/codecs/raw'
import { InvalidPBNodeError, NotUnixFSError, UnknownError } from '../errors.js'
import { resolve } from './utils/resolve.js'
import type { StatOptions, UnixFSStats } from '../index.js'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Mtime } from 'ipfs-unixfs'
import type { CID } from 'multiformats/cid'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:stat')

const defaultOptions: StatOptions = {

}

export async function stat (cid: CID, blockstore: Blockstore, options: Partial<StatOptions> = {}): Promise<UnixFSStats> {
  const opts: StatOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, options.path, blockstore, opts)

  log('stat %c', resolved.cid)

  const result = await exporter(resolved.cid, blockstore, opts)

  if (result.type !== 'file' && result.type !== 'directory' && result.type !== 'raw') {
    throw new NotUnixFSError()
  }

  let fileSize: bigint = 0n
  let dagSize: bigint = 0n
  let localFileSize: bigint = 0n
  let localDagSize: bigint = 0n
  let blocks: number = 0
  let mode: number | undefined
  let mtime: Mtime | undefined
  const type = result.type
  let unixfs: UnixFS | undefined

  if (result.type === 'raw') {
    fileSize = BigInt(result.node.byteLength)
    dagSize = BigInt(result.node.byteLength)
    localFileSize = BigInt(result.node.byteLength)
    localDagSize = BigInt(result.node.byteLength)
    blocks = 1
  }

  if (result.type === 'directory') {
    fileSize = 0n
    dagSize = BigInt(result.unixfs.marshal().byteLength)
    localFileSize = 0n
    localDagSize = dagSize
    blocks = 1
    mode = result.unixfs.mode
    mtime = result.unixfs.mtime
    unixfs = result.unixfs
  }

  if (result.type === 'file') {
    const results = await inspectDag(resolved.cid, blockstore, opts)

    fileSize = result.unixfs.fileSize()
    dagSize = BigInt((result.node.Data?.byteLength ?? 0) + result.node.Links.reduce((acc, curr) => acc + (curr.Tsize ?? 0), 0))
    localFileSize = BigInt(results.localFileSize)
    localDagSize = BigInt(results.localDagSize)
    blocks = results.blocks
    mode = result.unixfs.mode
    mtime = result.unixfs.mtime
    unixfs = result.unixfs
  }

  return {
    cid: resolved.cid,
    mode,
    mtime,
    fileSize,
    dagSize,
    localFileSize,
    localDagSize,
    blocks,
    type,
    unixfs
  }
}

interface InspectDagResults {
  localFileSize: number
  localDagSize: number
  blocks: number
}

async function inspectDag (cid: CID, blockstore: Blockstore, options: AbortOptions): Promise<InspectDagResults> {
  const results = {
    localFileSize: 0,
    localDagSize: 0,
    blocks: 0
  }

  if (await blockstore.has(cid, options)) {
    const block = await blockstore.get(cid, options)
    results.blocks++
    results.localDagSize += block.byteLength

    if (cid.code === raw.code) {
      results.localFileSize += block.byteLength
    } else if (cid.code === dagPb.code) {
      const pbNode = dagPb.decode(block)

      if (pbNode.Links.length > 0) {
        // intermediate node
        for (const link of pbNode.Links) {
          const linkResult = await inspectDag(link.Hash, blockstore, options)

          results.localFileSize += linkResult.localFileSize
          results.localDagSize += linkResult.localDagSize
          results.blocks += linkResult.blocks
        }
      } else {
        // leaf node
        if (pbNode.Data == null) {
          throw new InvalidPBNodeError(`PBNode ${cid.toString()} had no data`)
        }

        const unixfs = UnixFS.unmarshal(pbNode.Data)

        if (unixfs.data == null) {
          throw new InvalidPBNodeError(`UnixFS node ${cid.toString()} had no data`)
        }

        results.localFileSize += unixfs.data.byteLength ?? 0
      }
    } else {
      throw new UnknownError(`${cid.toString()} was neither DAG_PB nor RAW`)
    }
  }

  return results
}
