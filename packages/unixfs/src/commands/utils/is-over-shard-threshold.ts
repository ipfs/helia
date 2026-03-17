import * as dagPb from '@ipld/dag-pb'
import { InvalidParametersError } from '@libp2p/interface'
import { UnixFS } from 'ipfs-unixfs'
import { dataFieldSerializedSize, linkSerializedSize, utf8ByteLength } from 'ipfs-unixfs-importer/utils'
import toBuffer from 'it-to-buffer'
import { DEFAULT_SHARD_SPLIT_THRESHOLD_BYTES } from '../../constants.ts'
import { hamtBucketBits } from './hamt-constants.ts'
import type { GetStore } from '../../unixfs.js'
import type { PBNode } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interface'
import type { ImporterOptions, ShardSplitStrategy } from 'ipfs-unixfs-importer'

export interface IsOverShardThresholdOptions extends AbortOptions, Pick<ImporterOptions, 'profile' | 'shardSplitThresholdBytes' | 'shardSplitStrategy' | 'shardFanoutBits'> {

}

/**
 * Estimate node size only based on DAGLink name and CID byte lengths
 * https://github.com/ipfs/go-unixfsnode/blob/37b47f1f917f1b2f54c207682f38886e49896ef9/data/builder/directory.go#L81-L96
 *
 * If the node is a hamt sharded directory the calculation is based on if it was
 * a regular directory.
 */
export async function isOverShardThreshold (node: PBNode, blockstore: GetStore, options: IsOverShardThresholdOptions): Promise<boolean> {
  if (node.Data == null) {
    throw new Error('DagPB node had no data')
  }

  const threshold = options.shardSplitThresholdBytes ?? DEFAULT_SHARD_SPLIT_THRESHOLD_BYTES
  let strategy: ShardSplitStrategy = options.shardSplitStrategy ?? 'links-bytes'

  if (options.profile === 'unixfs-v0-2015') {
    strategy = 'links-bytes'
  }

  const unixfs = UnixFS.unmarshal(node.Data)

  if (!unixfs.isDirectory()) {
    throw new Error('Can only estimate the size of directories or shards')
  }

  if (strategy !== 'links-bytes' && strategy !== 'block-bytes') {
    throw new InvalidParametersError(`Invalid shard split threshold "${strategy}"`)
  }

  let size: number = 0

  if (unixfs.type === 'directory') {
    size = strategy === 'links-bytes' ? estimateNodeSize(node) : calculateNodeSize(unixfs, node)
  } else if (unixfs.type === 'hamt-sharded-directory') {
    size = strategy === 'links-bytes' ? await estimateShardSize(node, 0, threshold, blockstore, options) : await calculateShardSize(node, dataFieldSerializedSize(unixfs.mode, unixfs.mtime), threshold, blockstore, options)
  }

  return size > threshold
}

function estimateNodeSize (node: PBNode): number {
  let size = 0

  // estimate size only based on DAGLink name and CID byte lengths
  // https://github.com/ipfs/go-unixfsnode/blob/37b47f1f917f1b2f54c207682f38886e49896ef9/data/builder/directory.go#L81-L96
  for (const link of node.Links) {
    size += utf8ByteLength(link.Name ?? '')
    size += link.Hash.byteLength
  }

  return size
}

function calculateNodeSize (unixfs: UnixFS, node: PBNode): number {
  let size = dataFieldSerializedSize(unixfs.mode, unixfs.mtime)

  for (const link of node.Links) {
    size += linkSerializedSize(
      utf8ByteLength(link.Name ?? ''), link.Hash.byteLength, Number(link.Tsize ?? 0)
    )
  }

  return size
}

async function estimateShardSize (node: PBNode, current: number, max: number, blockstore: GetStore, options: IsOverShardThresholdOptions): Promise<number> {
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

  const prefixLength = (Math.pow(2, options.shardFanoutBits ?? hamtBucketBits) - 1).toString(16).length

  for (const link of node.Links) {
    let name = link.Name ?? ''

    // remove hamt hash prefix from name
    name = name.substring(prefixLength)

    current += utf8ByteLength(name)
    current += link.Hash.bytes.byteLength

    if (link.Hash.code === dagPb.code) {
      const block = await toBuffer(blockstore.get(link.Hash, options))
      const node = dagPb.decode(block)

      current += await estimateShardSize(node, current, max, blockstore, options)
    }
  }

  return current
}

async function calculateShardSize (node: PBNode, current: number, max: number, blockstore: GetStore, options: IsOverShardThresholdOptions): Promise<number> {
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

  const prefixLength = (Math.pow(2, options.shardFanoutBits ?? hamtBucketBits) - 1).toString(16).length

  for (const link of node.Links) {
    let name = link.Name ?? ''

    // remove hamt hash prefix from name
    name = name.substring(prefixLength)

    current += linkSerializedSize(
      utf8ByteLength(name), link.Hash.byteLength, Number(link.Tsize ?? 0)
    )

    if (link.Hash.code === dagPb.code) {
      const block = await toBuffer(blockstore.get(link.Hash, options))
      const node = dagPb.decode(block)

      current += await calculateShardSize(node, current, max, blockstore, options)
    }
  }

  return current
}
