
import * as dagPB from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import {
  generatePath,
  updateHamtDirectory,
  UpdateHamtResult
} from './hamt-utils.js'
import type { PBNode, PBLink } from '@ipld/dag-pb'
import type { Blockstore } from 'interface-blockstore'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Bucket } from 'hamt-sharding'
import type { Directory } from './cid-to-directory.js'
import type { AbortOptions } from '@libp2p/interfaces'
import { InvalidPBNodeError } from './errors.js'
import { InvalidParametersError } from '@helia/interface/errors'

const log = logger('helia:unixfs:utils:remove-link')

export interface RemoveLinkResult {
  node: PBNode
  cid: CID
}

export async function removeLink (parent: Directory, name: string, blockstore: Blockstore, options: AbortOptions): Promise<RemoveLinkResult> {
  if (parent.node.Data == null) {
    throw new InvalidPBNodeError('Parent node had no data')
  }

  const meta = UnixFS.unmarshal(parent.node.Data)

  if (meta.type === 'hamt-sharded-directory') {
    log(`Removing ${name} from sharded directory`)

    return await removeFromShardedDirectory(parent, name, blockstore, options)
  }

  log(`Removing link ${name} regular directory`)

  return await removeFromDirectory(parent, name, blockstore, options)
}

const removeFromDirectory = async (parent: Directory, name: string, blockstore: Blockstore, options: AbortOptions): Promise<RemoveLinkResult> => {
  // Remove existing link if it exists
  parent.node.Links = parent.node.Links.filter((link) => {
    return link.Name !== name
  })

  const parentBlock = dagPB.encode(parent.node)
  const hash = await sha256.digest(parentBlock)
  const parentCid = CID.create(parent.cid.version, dagPB.code, hash)

  await blockstore.put(parentCid, parentBlock, options)

  log(`Updated regular directory ${parentCid}`)

  return {
    node: parent.node,
    cid: parentCid
  }
}

const removeFromShardedDirectory = async (parent: Directory, name: string, blockstore: Blockstore, options: AbortOptions): Promise<UpdateHamtResult> => {
  const {
    rootBucket, path
  } = await generatePath(parent, name, blockstore, options)

  await rootBucket.del(name)

  const {
    node
  } = await updateShard(parent, blockstore, path, name, options)

  return await updateHamtDirectory(parent, blockstore, node.Links, rootBucket, options)
}

const updateShard = async (parent: Directory, blockstore: Blockstore, positions: Array<{ bucket: Bucket<any>, prefix: string, node?: PBNode }>, name: string, options: AbortOptions): Promise<{ node: PBNode, cid: CID, size: number }> => {
  const last = positions.pop()

  if (last == null) {
    throw new InvalidParametersError('Could not find parent')
  }

  const {
    bucket,
    prefix,
    node
  } = last

  if (node == null) {
    throw new InvalidParametersError('Could not find parent')
  }

  const link = node.Links
    .find(link => (link.Name ?? '').substring(0, 2) === prefix)

  if (link == null) {
    throw new InvalidParametersError(`No link found with prefix ${prefix} for file ${name}`)
  }

  if (link.Name === `${prefix}${name}`) {
    log(`Removing existing link ${link.Name}`)

    const links = node.Links.filter((nodeLink) => {
      return nodeLink.Name !== link.Name
    })

    await bucket.del(name)

    parent.node = node

    return await updateHamtDirectory(parent, blockstore, links, bucket, options)
  }

  log(`Descending into sub-shard ${link.Name} for ${prefix}${name}`)

  const result = await updateShard(parent, blockstore, positions, name, options)

  const child: Required<PBLink> = {
    Hash: result.cid,
    Tsize: result.size,
    Name: prefix
  }

  if (result.node.Links.length === 1) {
    log(`Removing subshard for ${prefix}`)

    // convert shard back to normal dir
    const link = result.node.Links[0]

    child.Name = `${prefix}${(link.Name ?? '').substring(2)}`
    child.Hash = link.Hash
    child.Tsize = link.Tsize ?? 0
  }

  log(`Updating shard ${prefix} with name ${child.Name}`)

  return await updateShardParent(parent, child, prefix, blockstore, bucket, options)
}

const updateShardParent = async (parent: Directory, child: Required<PBLink>, oldName: string, blockstore: Blockstore, bucket: Bucket<any>, options: AbortOptions): Promise<UpdateHamtResult> => {
  // Remove existing link if it exists
  const parentLinks = parent.node.Links.filter((link) => {
    return link.Name !== oldName
  })
  parentLinks.push(child)

  return await updateHamtDirectory(parent, blockstore, parentLinks, bucket, options)
}
