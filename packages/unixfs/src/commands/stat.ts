import { Blockstore, exporter } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import type { StatOptions, UnixFSStats } from '../index.js'
import mergeOpts from 'merge-options'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { InvalidPBNodeError, NotUnixFSError, UnknownError } from './utils/errors.js'
import * as dagPb from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Mtime } from 'ipfs-unixfs'
import { resolve } from './utils/resolve.js'
import * as raw from 'multiformats/codecs/raw'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:stat')

const defaultOptions = {

}

export async function stat (cid: CID, blockstore: Blockstore, options: Partial<StatOptions> = {}): Promise<UnixFSStats> {
  const opts: StatOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, options.path, blockstore, opts)

  log('stat %c', resolved.cid)

  const result = await exporter(resolved.cid, blockstore, opts)

  if (result.type !== 'file' && result.type !== 'directory' && result.type !== 'raw') {
    throw new NotUnixFSError()
  }

  let fileSize: number = 0
  let dagSize: number = 0
  let localFileSize: number = 0
  let localDagSize: number = 0
  let blocks: number = 0
  let mode: number | undefined
  let mtime: Mtime | undefined
  const type = result.type

  if (result.type === 'raw') {
    fileSize = result.node.byteLength
    dagSize = result.node.byteLength
    localFileSize = result.node.byteLength
    localDagSize = result.node.byteLength
    blocks = 1
  }

  if (result.type === 'directory') {
    fileSize = 0
    dagSize = result.unixfs.marshal().byteLength
    localFileSize = 0
    localDagSize = dagSize
    blocks = 1
    mode = result.unixfs.mode
    mtime = result.unixfs.mtime
  }

  if (result.type === 'file') {
    const results = await inspectDag(resolved.cid, blockstore, opts)

    fileSize = result.unixfs.fileSize()
    dagSize = (result.node.Data?.byteLength ?? 0) + result.node.Links.reduce((acc, curr) => acc + (curr.Tsize ?? 0), 0)
    localFileSize = results.localFileSize
    localDagSize = results.localDagSize
    blocks = results.blocks
    mode = result.unixfs.mode
    mtime = result.unixfs.mtime
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
    type
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
