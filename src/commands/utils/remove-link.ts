
import * as dagPB from '@ipld/dag-pb'
import type { CID, Version } from 'multiformats/cid'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import {
  generatePath,
  HamtPathSegment,
  updateHamtDirectory,
  UpdateHamtDirectoryOptions
} from './hamt-utils.js'
import type { PBNode } from '@ipld/dag-pb'
import type { Blockstore } from 'interface-blockstore'
import type { Directory } from './cid-to-directory.js'
import type { AbortOptions } from '@libp2p/interfaces'
import { InvalidParametersError, InvalidPBNodeError } from './errors.js'
import { exporter } from 'ipfs-unixfs-exporter'
import { persist } from './persist.js'
import { isOverShardThreshold } from './is-over-shard-threshold.js'

const log = logger('helia:unixfs:utils:remove-link')

export interface RmLinkOptions extends AbortOptions {
  shardSplitThresholdBytes: number
  cidVersion: Version
}

export interface RemoveLinkResult {
  node: PBNode
  cid: CID
}

export async function removeLink (parent: Directory, name: string, blockstore: Blockstore, options: RmLinkOptions): Promise<RemoveLinkResult> {
  if (parent.node.Data == null) {
    throw new InvalidPBNodeError('Parent node had no data')
  }

  const meta = UnixFS.unmarshal(parent.node.Data)

  if (meta.type === 'hamt-sharded-directory') {
    log(`removing ${name} from sharded directory`)

    const result = await removeFromShardedDirectory(parent, name, blockstore, options)

    if (!(await isOverShardThreshold(result.node, blockstore, options.shardSplitThresholdBytes))) {
      log('converting shard to flat directory %c', parent.cid)

      return await convertToFlatDirectory(result, blockstore, options)
    }

    return result
  }

  log(`removing link ${name} regular directory`)

  return await removeFromDirectory(parent, name, blockstore, options)
}

const removeFromDirectory = async (parent: Directory, name: string, blockstore: Blockstore, options: AbortOptions): Promise<RemoveLinkResult> => {
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

const removeFromShardedDirectory = async (parent: Directory, name: string, blockstore: Blockstore, options: UpdateHamtDirectoryOptions): Promise<{ cid: CID, node: PBNode }> => {
  const path = await generatePath(parent, name, blockstore, options)

  // remove file from root bucket
  const rootBucket = path[path.length - 1].bucket

  if (rootBucket == null) {
    throw new Error('Could not generate HAMT path')
  }

  await rootBucket.del(name)

  // update all nodes in the shard path
  return await updateShard(path, name, blockstore, options)
}

/**
 * The `path` param is a list of HAMT path segments starting with th
 */
const updateShard = async (path: HamtPathSegment[], name: string, blockstore: Blockstore, options: UpdateHamtDirectoryOptions): Promise<{ node: PBNode, cid: CID }> => {
  const fileName = `${path[0].prefix}${name}`

  // skip first path segment as it is the file to remove
  for (let i = 1; i < path.length; i++) {
    const lastPrefix = path[i - 1].prefix
    const segment = path[i]

    if (segment.node == null) {
      throw new InvalidParametersError('Path segment had no associated PBNode')
    }

    const link = segment.node.Links
      .find(link => (link.Name ?? '').substring(0, 2) === lastPrefix)

    if (link == null) {
      throw new InvalidParametersError(`No link found with prefix ${lastPrefix} for file ${name}`)
    }

    if (link.Name == null) {
      throw new InvalidParametersError(`${lastPrefix} link had no name`)
    }

    if (link.Name === fileName) {
      log(`removing existing link ${link.Name}`)

      const links = segment.node.Links.filter((nodeLink) => {
        return nodeLink.Name !== link.Name
      })

      if (segment.bucket == null) {
        throw new Error('Segment bucket was missing')
      }

      await segment.bucket.del(name)

      const result = await updateHamtDirectory({
        Data: segment.node.Data,
        Links: links
      }, blockstore, segment.bucket, options)

      segment.node = result.node
      segment.cid = result.cid
      segment.size = result.size
    }

    if (link.Name === lastPrefix) {
      log(`updating subshard with prefix ${lastPrefix}`)

      const lastSegment = path[i - 1]

      if (lastSegment.node?.Links.length === 1) {
        log(`removing subshard for ${lastPrefix}`)

        // convert subshard back to normal file entry
        const link = lastSegment.node.Links[0]
        link.Name = `${lastPrefix}${(link.Name ?? '').substring(2)}`

        // remove existing prefix
        segment.node.Links = segment.node.Links.filter((link) => {
          return link.Name !== lastPrefix
        })

        // add new child
        segment.node.Links.push(link)
      } else {
        // replace subshard entry
        log(`replacing subshard for ${lastPrefix}`)

        // remove existing prefix
        segment.node.Links = segment.node.Links.filter((link) => {
          return link.Name !== lastPrefix
        })

        if (lastSegment.cid == null) {
          throw new Error('Did not persist previous segment')
        }

        // add new child
        segment.node.Links.push({
          Name: lastPrefix,
          Hash: lastSegment.cid,
          Tsize: lastSegment.size
        })
      }

      if (segment.bucket == null) {
        throw new Error('Segment bucket was missing')
      }

      const result = await updateHamtDirectory(segment.node, blockstore, segment.bucket, options)
      segment.node = result.node
      segment.cid = result.cid
      segment.size = result.size
    }
  }

  const rootSegment = path[path.length - 1]

  if (rootSegment == null || rootSegment.cid == null || rootSegment.node == null) {
    throw new InvalidParametersError('Failed to update shard')
  }

  return {
    cid: rootSegment.cid,
    node: rootSegment.node
  }
}

const convertToFlatDirectory = async (parent: Directory, blockstore: Blockstore, options: RmLinkOptions): Promise<RemoveLinkResult> => {
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
