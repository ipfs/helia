import * as dagPb from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs'
import { CID_V0, CID_V1 } from './dir-sharded.js'
import type { GetStore } from '../../unixfs.js'
import type { PBNode } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interface'

/**
 * Estimate node size only based on DAGLink name and CID byte lengths
 * https://github.com/ipfs/go-unixfsnode/blob/37b47f1f917f1b2f54c207682f38886e49896ef9/data/builder/directory.go#L81-L96
 *
 * If the node is a hamt sharded directory the calculation is based on if it was a regular directory.
 */
export async function isOverShardThreshold (node: PBNode, blockstore: GetStore, threshold: number, options: AbortOptions): Promise<boolean> {
  if (node.Data == null) {
    throw new Error('DagPB node had no data')
  }

  const unixfs = UnixFS.unmarshal(node.Data)
  let size: number

  if (unixfs.type === 'directory') {
    size = estimateNodeSize(node)
  } else if (unixfs.type === 'hamt-sharded-directory') {
    size = await estimateShardSize(node, 0, threshold, blockstore, options)
  } else {
    throw new Error('Can only estimate the size of directories or shards')
  }

  return size > threshold
}

function estimateNodeSize (node: PBNode): number {
  let size = 0

  // estimate size only based on DAGLink name and CID byte lengths
  // https://github.com/ipfs/go-unixfsnode/blob/37b47f1f917f1b2f54c207682f38886e49896ef9/data/builder/directory.go#L81-L96
  for (const link of node.Links) {
    size += (link.Name ?? '').length
    size += link.Hash.version === 1 ? CID_V1.bytes.byteLength : CID_V0.bytes.byteLength
  }

  return size
}

async function estimateShardSize (node: PBNode, current: number, max: number, blockstore: GetStore, options: AbortOptions): Promise<number> {
  if (current > max) {
    return max
  }

  if (node.Data == null) {
    return current
  }

  const unixfs = UnixFS.unmarshal(node.Data)

  if (!unixfs.isDirectory()) {
    return current
  }

  for (const link of node.Links) {
    let name = link.Name ?? ''

    // remove hamt hash prefix from name
    name = name.substring(2)

    current += name.length
    current += link.Hash.bytes.byteLength

    if (link.Hash.code === dagPb.code) {
      const block = await blockstore.get(link.Hash, options)
      const node = dagPb.decode(block)

      current += await estimateShardSize(node, current, max, blockstore, options)
    }
  }

  return current
}
