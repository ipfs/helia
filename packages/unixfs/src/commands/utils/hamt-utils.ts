import * as dagPB from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import last from 'it-last'
// @ts-expect-error no types
import SparseArray from 'sparse-array'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { wrapHash } from './consumable-hash.js'
import { DirSharded } from './dir-sharded.js'
import {
  hamtHashCode,
  hamtHashFn,
  hamtBucketBits
} from './hamt-constants.js'
import { persist } from './persist.js'
import type { InfiniteHash } from './consumable-hash.js'
import type { PersistOptions } from './persist.js'
import type { GetStore, PutStore } from '../../unixfs.js'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { Mtime } from 'ipfs-unixfs'
import type { ImportResult } from 'ipfs-unixfs-importer'
import type { CID, Version } from 'multiformats/cid'

const log = logger('helia:unixfs:commands:utils:hamt-utils')

export interface UpdateHamtDirectoryOptions extends AbortOptions {
  cidVersion: Version
}

export const toPrefix = (position: number): string => {
  return position
    .toString(16)
    .toUpperCase()
    .padStart(2, '0')
    .substring(0, 2)
}

export interface CreateShardOptions {
  mtime?: Mtime
  mode?: number
  cidVersion: Version
}

export const createShard = async (blockstore: PutStore, contents: Array<{ name: string, size: bigint, cid: CID }>, options: CreateShardOptions): Promise<ImportResult> => {
  const shard = new DirSharded({
    root: true,
    dir: true,
    parent: undefined,
    parentKey: undefined,
    path: '',
    dirty: true,
    flat: false,
    mtime: options.mtime,
    mode: options.mode
  }, options)

  for (let i = 0; i < contents.length; i++) {
    await shard._bucket.put(contents[i].name, {
      size: contents[i].size,
      cid: contents[i].cid
    })
  }

  const res = await last(shard.flush(blockstore))

  if (res == null) {
    throw new Error('Flushing shard yielded no result')
  }

  return res
}

export interface HAMTPath {
  prefix: string
  children: SparseArray
  node: dagPB.PBNode
}

export const updateShardedDirectory = async (path: HAMTPath[], blockstore: GetStore & PutStore, options: PersistOptions): Promise<{ cid: CID, node: dagPB.PBNode }> => {
  // persist any metadata on the shard root
  const shardRoot = UnixFS.unmarshal(path[0].node.Data ?? new Uint8Array(0))

  // this is always the same
  const fanout = BigInt(Math.pow(2, hamtBucketBits))

  // start from the leaf and ascend to the root
  path.reverse()

  let cid: CID | undefined
  let node: dagPB.PBNode | undefined

  for (let i = 0; i < path.length; i++) {
    const isRoot = i === path.length - 1
    const segment = path[i]

    // go-ipfs uses little endian, that's why we have to
    // reverse the bit field before storing it
    const data = Uint8Array.from(segment.children.bitField().reverse())
    const dir = new UnixFS({
      type: 'hamt-sharded-directory',
      data,
      fanout,
      hashType: hamtHashCode
    })

    if (isRoot) {
      dir.mtime = shardRoot.mtime
      dir.mode = shardRoot.mode
    }

    node = {
      Data: dir.marshal(),
      Links: segment.node.Links
    }

    const block = dagPB.encode(dagPB.prepare(node))

    cid = await persist(block, blockstore, options)

    if (!isRoot) {
      // update link in parent sub-shard
      const nextSegment = path[i + 1]

      if (nextSegment == null) {
        throw new Error('Was not operating on shard root but also had no parent?')
      }

      log('updating link in parent sub-shard with prefix %s', nextSegment.prefix)

      nextSegment.node.Links = nextSegment.node.Links.filter(l => l.Name !== nextSegment.prefix)
      nextSegment.node.Links.push({
        Name: nextSegment.prefix,
        Hash: cid,
        Tsize: segment.node.Links.reduce((acc, curr) => acc + (curr.Tsize ?? 0), block.byteLength)
      })
    }
  }

  if (cid == null || node == null) {
    throw new Error('Noting persisted')
  }

  return { cid, node }
}

export const recreateShardedDirectory = async (cid: CID, fileName: string, blockstore: Pick<Blockstore, 'get'>, options: AbortOptions): Promise<{ path: HAMTPath[], hash: InfiniteHash }> => {
  const wrapped = wrapHash(hamtHashFn)
  const hash = wrapped(uint8ArrayFromString(fileName))
  const path: HAMTPath[] = []

  // descend the HAMT, loading each layer as we head towards the target child
  while (true) {
    const block = await blockstore.get(cid, options)
    const node = dagPB.decode(block)
    const children = new SparseArray()
    const index = await hash.take(hamtBucketBits)
    const prefix = toPrefix(index)

    path.push({
      prefix,
      children,
      node
    })

    let childLink: dagPB.PBLink | undefined

    // update sparsearray child layout - the bitfield is used as the data field for the
    // intermediate DAG node so this is required to generate consistent hashes
    for (const link of node.Links) {
      const linkName = link.Name ?? ''

      if (linkName.length < 2) {
        throw new Error('Invalid HAMT - link name was too short')
      }

      const position = parseInt(linkName.substring(0, 2), 16)
      children.set(position, true)

      // we found the child we are looking for
      if (linkName.startsWith(prefix)) {
        childLink = link
      }
    }

    if (childLink == null) {
      log('no link found with prefix %s for %s', prefix, fileName)
      // hash.untake(hamtBucketBits)
      break
    }

    const linkName = childLink.Name ?? ''

    if (linkName.length < 2) {
      throw new Error('Invalid HAMT - link name was too short')
    }

    if (linkName.length === 2) {
      // found sub-shard
      cid = childLink.Hash
      log('descend into sub-shard with prefix %s', linkName)

      continue
    }

    break
  }

  return { path, hash }
}
