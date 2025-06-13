import * as dagPB from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { exporter } from 'ipfs-unixfs-exporter'
import { InvalidParametersError, InvalidPBNodeError } from '../../errors.js'
import {
  recreateShardedDirectory,

  updateShardedDirectory
} from './hamt-utils.js'
import { isOverShardThreshold } from './is-over-shard-threshold.js'
import { persist } from './persist.js'
import type { Directory } from './cid-to-directory.js'
import type { UpdateHamtDirectoryOptions } from './hamt-utils.js'
import type { GetStore, PutStore } from '../../unixfs.js'
import type { PBNode } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interface'
import type { CID, Version } from 'multiformats/cid'

const log = logger('helia:unixfs:utils:remove-link')

export interface RmLinkOptions extends AbortOptions {
  shardSplitThresholdBytes: number
  cidVersion: Version
}

export interface RemoveLinkResult {
  node: PBNode
  cid: CID
}

export async function removeLink (parent: Directory, name: string, blockstore: PutStore & GetStore, options: RmLinkOptions): Promise<RemoveLinkResult> {
  if (parent.node.Data == null) {
    throw new InvalidPBNodeError('Parent node had no data')
  }

  const meta = UnixFS.unmarshal(parent.node.Data)

  if (meta.type === 'hamt-sharded-directory') {
    log(`removing ${name} from sharded directory`)

    const result = await removeFromShardedDirectory(parent, name, blockstore, options)

    if (!(await isOverShardThreshold(result.node, blockstore, options.shardSplitThresholdBytes, options))) {
      log('converting shard to flat directory %c', parent.cid)

      return convertToFlatDirectory(result, blockstore, options)
    }

    return result
  }

  log(`removing link ${name} regular directory`)

  return removeFromDirectory(parent, name, blockstore, options)
}

const removeFromDirectory = async (parent: Directory, name: string, blockstore: PutStore & GetStore, options: AbortOptions): Promise<RemoveLinkResult> => {
  // Remove existing link if it exists
  parent.node.Links = parent.node.Links.filter((link) => {
    return link.Name !== name
  })

  const parentBlock = dagPB.encode(parent.node)
  const parentCid = await persist(parentBlock, blockstore, {
    ...options,
    cidVersion: parent.cid.version
  })

  log(`Updated regular directory ${parentCid}`)

  return {
    node: parent.node,
    cid: parentCid
  }
}

const removeFromShardedDirectory = async (parent: Directory, name: string, blockstore: PutStore & GetStore, options: UpdateHamtDirectoryOptions): Promise<{ cid: CID, node: PBNode }> => {
  const { path } = await recreateShardedDirectory(parent.cid, name, blockstore, options)
  const finalSegment = path[path.length - 1]

  if (finalSegment == null) {
    throw new Error('Invalid HAMT, could not generate path')
  }

  const linkName = finalSegment.node.Links.filter(l => (l.Name ?? '').substring(2) === name).map(l => l.Name).pop()

  if (linkName == null) {
    throw new Error('File not found')
  }

  const prefix = linkName.substring(0, 2)
  const index = parseInt(prefix, 16)

  // remove the file from the shard
  finalSegment.node.Links = finalSegment.node.Links.filter(link => link.Name !== linkName)
  finalSegment.children.unset(index)

  if (finalSegment.node.Links.length === 1) {
    // replace the sub-shard with the last remaining file in the parent
    while (true) {
      if (path.length === 1) {
        break
      }

      const segment = path[path.length - 1]

      if (segment == null || segment.node.Links.length > 1) {
        break
      }

      // remove final segment
      path.pop()

      const nextSegment = path[path.length - 1]

      if (nextSegment == null) {
        break
      }

      const link = segment.node.Links[0]

      nextSegment.node.Links = nextSegment.node.Links.filter(l => !(l.Name ?? '').startsWith(nextSegment.prefix))
      nextSegment.node.Links.push({
        Hash: link.Hash,
        Name: `${nextSegment.prefix}${(link.Name ?? '').substring(2)}`,
        Tsize: link.Tsize
      })
    }
  }

  return updateShardedDirectory(path, blockstore, options)
}

const convertToFlatDirectory = async (parent: Directory, blockstore: PutStore & GetStore, options: RmLinkOptions): Promise<RemoveLinkResult> => {
  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to convertToFlatDirectory')
  }

  const rootNode: PBNode = {
    Links: []
  }
  const dir = await exporter(parent.cid, blockstore)

  if (dir.type !== 'directory') {
    throw new Error('Unexpected node type')
  }

  for await (const entry of dir.content()) {
    let tsize = 0

    if (entry.node instanceof Uint8Array) {
      tsize = entry.node.byteLength
    } else {
      tsize = dagPB.encode(entry.node).length
    }

    rootNode.Links.push({
      Hash: entry.cid,
      Name: entry.name,
      Tsize: tsize
    })
  }

  // copy mode/mtime over if set
  const oldUnixfs = UnixFS.unmarshal(parent.node.Data)
  rootNode.Data = new UnixFS({ type: 'directory', mode: oldUnixfs.mode, mtime: oldUnixfs.mtime }).marshal()
  const block = dagPB.encode(dagPB.prepare(rootNode))

  const cid = await persist(block, blockstore, {
    codec: dagPB,
    cidVersion: parent.cid.version,
    signal: options.signal
  })

  return {
    cid,
    node: rootNode
  }
}
