import * as dagPB from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
// @ts-expect-error no types
import SparseArray from 'sparse-array'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { AlreadyExistsError, InvalidParametersError, InvalidPBNodeError } from '../../errors.js'
import { wrapHash } from './consumable-hash.js'
import { hamtBucketBits, hamtHashFn } from './hamt-constants.js'
import {
  createShard,
  recreateShardedDirectory,
  toPrefix,
  updateShardedDirectory
} from './hamt-utils.js'
import { isOverShardThreshold } from './is-over-shard-threshold.js'
import type { Directory } from './cid-to-directory.js'
import type { GetStore, PutStore } from '../../unixfs.js'
import type { PBNode, PBLink } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interface'
import type { ImportResult } from 'ipfs-unixfs-importer'
import type { Version } from 'multiformats/cid'

const log = logger('helia:unixfs:components:utils:add-link')

export interface AddLinkResult {
  node: PBNode
  cid: CID
}

export interface AddLinkOptions extends AbortOptions {
  allowOverwriting: boolean
  shardSplitThresholdBytes: number
  cidVersion: Version
}

export async function addLink (parent: Directory, child: Required<PBLink>, blockstore: GetStore & PutStore, options: AddLinkOptions): Promise<AddLinkResult> {
  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to addLink')
  }

  const meta = UnixFS.unmarshal(parent.node.Data)

  if (meta.type === 'hamt-sharded-directory') {
    log('adding link to sharded directory')

    return addToShardedDirectory(parent, child, blockstore, options)
  }

  log(`adding ${child.Name} (${child.Hash}) to regular directory`)

  const result = await addToDirectory(parent, child, blockstore, options)

  if (await isOverShardThreshold(result.node, blockstore, options.shardSplitThresholdBytes, options)) {
    log('converting directory to sharded directory')

    const converted = await convertToShardedDirectory(result, blockstore)
    result.cid = converted.cid
    result.node = dagPB.decode(await blockstore.get(converted.cid, options))
  }

  return result
}

const convertToShardedDirectory = async (parent: Directory, blockstore: PutStore): Promise<ImportResult> => {
  if (parent.node.Data == null) {
    throw new InvalidParametersError('Invalid parent passed to convertToShardedDirectory')
  }

  const unixfs = UnixFS.unmarshal(parent.node.Data)

  const result = await createShard(blockstore, parent.node.Links.map(link => ({
    name: (link.Name ?? ''),
    size: BigInt(link.Tsize ?? 0),
    cid: link.Hash
  })), {
    mode: unixfs.mode,
    mtime: unixfs.mtime,
    cidVersion: parent.cid.version
  })

  log(`converted directory to sharded directory ${result.cid}`)

  return result
}

const addToDirectory = async (parent: Directory, child: PBLink, blockstore: PutStore, options: AddLinkOptions): Promise<AddLinkResult> => {
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
      secs: BigInt(secs),
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
    cid
  }
}

const addToShardedDirectory = async (parent: Directory, child: Required<PBLink>, blockstore: GetStore & PutStore, options: AddLinkOptions): Promise<AddLinkResult> => {
  const { path, hash } = await recreateShardedDirectory(parent.cid, child.Name, blockstore, options)
  const finalSegment = path[path.length - 1]

  if (finalSegment == null) {
    throw new Error('Invalid HAMT, could not generate path')
  }

  // find the next prefix
  // const index = await hash.take(hamtBucketBits)
  const prefix = finalSegment.prefix
  const index = parseInt(prefix, 16)

  log('next prefix for %s is %s', child.Name, prefix)

  const linkName = `${prefix}${child.Name}`
  const existingLink = finalSegment.node.Links.find(l => (l.Name ?? '').startsWith(prefix))

  if (existingLink != null) {
    log('link %s was present in shard', linkName)
    // link is already present in shard

    if (existingLink.Name === linkName) {
      // file with same name is already present in shard
      if (!options.allowOverwriting) {
        throw new AlreadyExistsError()
      }

      log('overwriting %s in sub-shard', child.Name)
      finalSegment.node.Links = finalSegment.node.Links.filter(l => l.Name !== linkName)
      finalSegment.node.Links.push({
        Name: linkName,
        Hash: child.Hash,
        Tsize: child.Tsize
      })
    } else if (existingLink.Name?.length === 2) {
      throw new Error('Existing link was sub-shard?!')
    } else {
      // conflict, add a new HAMT segment
      log('prefix %s already exists, creating new sub-shard', prefix)
      // find the sibling we are going to replace
      const index = finalSegment.node.Links.findIndex(l => l.Name?.startsWith(prefix))
      const sibling = finalSegment.node.Links.splice(index, 1)[0]

      // give the sibling a new HAMT prefix
      const siblingName = (sibling.Name ?? '').substring(2)
      const wrapped = wrapHash(hamtHashFn)
      const siblingHash = wrapped(uint8ArrayFromString(siblingName))

      // discard hash bits until we reach the sub-shard depth
      for (let i = 0; i < path.length; i++) {
        await siblingHash.take(hamtBucketBits)
      }

      while (true) {
        const siblingIndex = await siblingHash.take(hamtBucketBits)
        const siblingPrefix = toPrefix(siblingIndex)
        sibling.Name = `${siblingPrefix}${siblingName}`

        // calculate the target file's HAMT prefix in the new sub-shard
        const newIndex = await hash.take(hamtBucketBits)
        const newPrefix = toPrefix(newIndex)

        if (siblingPrefix === newPrefix) {
          // the two sibling names have caused another conflict - add an intermediate node to
          // the HAMT and try again

          // create the child locations
          const children = new SparseArray()
          children.set(newIndex, true)

          path.push({
            prefix: newPrefix,
            children,
            node: {
              Links: []
            }
          })

          continue
        }

        // create the child locations
        const children = new SparseArray()
        children.set(newIndex, true)
        children.set(siblingIndex, true)

        // add our new segment
        path.push({
          prefix,
          children,
          node: {
            Links: [
              sibling, {
                Name: `${newPrefix}${child.Name}`,
                Hash: child.Hash,
                Tsize: child.Tsize
              }
            ]
          }
        })

        break
      }
    }
  } else {
    log('link %s was not present in sub-shard', linkName)

    // add new link to shard
    child.Name = linkName
    finalSegment.node.Links.push(child)
    finalSegment.children.set(index, true)

    log('adding %s to existing sub-shard', linkName)
  }

  return updateShardedDirectory(path, blockstore, options)
}
