import * as dagPB from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { DirSharded } from './dir-sharded.js'
import {
  updateHamtDirectory,
  recreateHamtLevel,
  recreateInitialHamtLevel,
  createShard,
  toPrefix,
  addLinksToHamtBucket
} from './hamt-utils.js'
import last from 'it-last'
import type { Blockstore } from 'ipfs-unixfs-exporter'
import type { PBNode, PBLink } from '@ipld/dag-pb/interface'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Bucket } from 'hamt-sharding'
import { AlreadyExistsError, InvalidPBNodeError } from './errors.js'
import { InvalidParametersError } from '@helia/interface/errors'
import type { ImportResult } from 'ipfs-unixfs-importer'
import type { AbortOptions } from '@libp2p/interfaces'
import type { Directory } from './cid-to-directory.js'

const log = logger('helia:unixfs:components:utils:add-link')

export interface AddLinkResult {
  node: PBNode
  cid: CID
  size: number
}

export interface AddLinkOptions extends AbortOptions {
  allowOverwriting: boolean
}

export async function addLink (parent: Directory, child: Required<PBLink>, blockstore: Blockstore, options: AddLinkOptions): Promise<AddLinkResult> {
  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to addLink')
  }

  // FIXME: this should work on block size not number of links
  if (parent.node.Links.length >= 1000) {
    log('converting directory to sharded directory')

    const result = await convertToShardedDirectory(parent, blockstore)
    parent.cid = result.cid
    parent.node = dagPB.decode(await blockstore.get(result.cid))
  }

  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to addLink')
  }

  const meta = UnixFS.unmarshal(parent.node.Data)

  if (meta.type === 'hamt-sharded-directory') {
    log('adding link to sharded directory')

    return await addToShardedDirectory(parent, child, blockstore, options)
  }

  log(`adding ${child.Name} (${child.Hash}) to regular directory`)

  return await addToDirectory(parent, child, blockstore, options)
}

const convertToShardedDirectory = async (parent: Directory, blockstore: Blockstore): Promise<ImportResult> => {
  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to convertToShardedDirectory')
  }

  const unixfs = UnixFS.unmarshal(parent.node.Data)

  const result = await createShard(blockstore, parent.node.Links.map(link => ({
    name: (link.Name ?? ''),
    size: link.Tsize ?? 0,
    cid: link.Hash
  })), {
    mode: unixfs.mode,
    mtime: unixfs.mtime
  })

  log(`Converted directory to sharded directory ${result.cid}`)

  return result
}

const addToDirectory = async (parent: Directory, child: PBLink, blockstore: Blockstore, options: AddLinkOptions): Promise<AddLinkResult> => {
  // Remove existing link if it exists
  const parentLinks = parent.node.Links.filter((link) => {
    const matches = link.Name === child.Name

    if (matches && !options.allowOverwriting) {
      throw new AlreadyExistsError()
    }

    return !matches
  })
  parentLinks.push(child)

  if (parent.node.Data == null) {
    throw new InvalidPBNodeError('Parent node with no data passed to addToDirectory')
  }

  const node = UnixFS.unmarshal(parent.node.Data)

  let data
  if (node.mtime != null) {
    // Update mtime if previously set
    const ms = Date.now()
    const secs = Math.floor(ms / 1000)

    node.mtime = {
      secs,
      nsecs: (ms - (secs * 1000)) * 1000
    }

    data = node.marshal()
  } else {
    data = parent.node.Data
  }
  parent.node = dagPB.prepare({
    Data: data,
    Links: parentLinks
  })

  // Persist the new parent PbNode
  const buf = dagPB.encode(parent.node)
  const hash = await sha256.digest(buf)
  const cid = CID.create(parent.cid.version, dagPB.code, hash)

  await blockstore.put(cid, buf)

  return {
    node: parent.node,
    cid,
    size: buf.length
  }
}

const addToShardedDirectory = async (parent: Directory, child: Required<PBLink>, blockstore: Blockstore, options: AddLinkOptions): Promise<AddLinkResult> => {
  const {
    shard, path
  } = await addFileToShardedDirectory(parent, child, blockstore, options)
  const result = await last(shard.flush(blockstore))

  if (result == null) {
    throw new Error('No result from flushing shard')
  }

  const block = await blockstore.get(result.cid)
  const node = dagPB.decode(block)

  // we have written out the shard, but only one sub-shard will have been written so replace it in the original shard
  const parentLinks = parent.node.Links.filter((link) => {
    const matches = (link.Name ?? '').substring(0, 2) === path[0].prefix

    if (matches && !options.allowOverwriting) {
      throw new AlreadyExistsError()
    }

    return !matches
  })

  const newLink = node.Links
    .find(link => (link.Name ?? '').substring(0, 2) === path[0].prefix)

  if (newLink == null) {
    throw new Error(`No link found with prefix ${path[0].prefix}`)
  }

  parentLinks.push(newLink)

  return await updateHamtDirectory(parent, blockstore, parentLinks, path[0].bucket, options)
}

const addFileToShardedDirectory = async (parent: Directory, child: Required<PBLink>, blockstore: Blockstore, options: AddLinkOptions): Promise<{ shard: DirSharded, path: BucketPath[] }> => {
  if (parent.node.Data == null) {
    throw new InvalidPBNodeError('Parent node with no data passed to addFileToShardedDirectory')
  }

  // start at the root bucket and descend, loading nodes as we go
  const rootBucket = await recreateInitialHamtLevel(parent.node.Links)
  const node = UnixFS.unmarshal(parent.node.Data)

  const shard = new DirSharded({
    root: true,
    dir: true,
    parent: undefined,
    parentKey: undefined,
    path: '',
    dirty: true,
    flat: false,
    mode: node.mode
  }, {
    ...options,
    cidVersion: parent.cid.version
  })
  shard._bucket = rootBucket

  if (node.mtime != null) {
    // update mtime if previously set
    shard.mtime = {
      secs: Math.round(Date.now() / 1000)
    }
  }

  // load subshards until the bucket & position no longer changes
  const position = await rootBucket._findNewBucketAndPos(child.Name)
  const path = toBucketPath(position)
  path[0].node = parent.node
  let index = 0

  while (index < path.length) {
    const segment = path[index]
    index++
    const node = segment.node

    if (node == null) {
      throw new Error('Segment had no node')
    }

    const link = node.Links
      .find(link => (link.Name ?? '').substring(0, 2) === segment.prefix)

    if (link == null) {
      // prefix is new, file will be added to the current bucket
      log(`Link ${segment.prefix}${child.Name} will be added`)
      index = path.length

      break
    }

    if (link.Name === `${segment.prefix}${child.Name}`) {
      // file already existed, file will be added to the current bucket
      log(`Link ${segment.prefix}${child.Name} will be replaced`)
      index = path.length

      break
    }

    if ((link.Name ?? '').length > 2) {
      // another file had the same prefix, will be replaced with a subshard
      log(`Link ${link.Name} ${link.Hash} will be replaced with a subshard`)
      index = path.length

      break
    }

    // load sub-shard
    log(`Found subshard ${segment.prefix}`)
    const block = await blockstore.get(link.Hash)
    const subShard = dagPB.decode(block)

    // subshard hasn't been loaded, descend to the next level of the HAMT
    if (path[index] == null) {
      log(`Loaded new subshard ${segment.prefix}`)
      await recreateHamtLevel(blockstore, subShard.Links, rootBucket, segment.bucket, parseInt(segment.prefix, 16), options)

      const position = await rootBucket._findNewBucketAndPos(child.Name)

      path.push({
        bucket: position.bucket,
        prefix: toPrefix(position.pos),
        node: subShard
      })

      break
    }

    const nextSegment = path[index]

    // add next levels worth of links to bucket
    await addLinksToHamtBucket(blockstore, subShard.Links, nextSegment.bucket, rootBucket, options)

    nextSegment.node = subShard
  }

  // finally add the new file into the shard
  await shard._bucket.put(child.Name, {
    size: child.Tsize,
    cid: child.Hash
  })

  return {
    shard, path
  }
}

export interface BucketPath {
  bucket: Bucket<any>
  prefix: string
  node?: PBNode
}

const toBucketPath = (position: { pos: number, bucket: Bucket<any> }): BucketPath[] => {
  const path = [{
    bucket: position.bucket,
    prefix: toPrefix(position.pos)
  }]

  let bucket = position.bucket._parent
  let positionInBucket = position.bucket._posAtParent

  while (bucket != null) {
    path.push({
      bucket,
      prefix: toPrefix(positionInBucket)
    })

    positionInBucket = bucket._posAtParent
    bucket = bucket._parent
  }

  path.reverse()

  return path
}
