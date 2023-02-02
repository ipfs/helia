import * as dagPB from '@ipld/dag-pb'
import {
  Bucket,
  createHAMT
} from 'hamt-sharding'
import { DirSharded } from './dir-sharded.js'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import last from 'it-last'
import { CID } from 'multiformats/cid'
import {
  hamtHashCode,
  hamtHashFn,
  hamtBucketBits
} from './hamt-constants.js'
import type { PBLink, PBNode } from '@ipld/dag-pb/interface'
import { sha256 } from 'multiformats/hashes/sha2'
import type { Blockstore } from 'interface-blockstore'
import type { Mtime } from 'ipfs-unixfs'
import type { Directory } from './cid-to-directory.js'
import type { AbortOptions } from '@libp2p/interfaces'
import type { ImportResult } from 'ipfs-unixfs-importer'

const log = logger('helia:unixfs:commands:utils:hamt-utils')

export interface UpdateHamtResult {
  node: PBNode
  cid: CID
  size: number
}

export const updateHamtDirectory = async (parent: Directory, blockstore: Blockstore, links: PBLink[], bucket: Bucket<any>, options: AbortOptions): Promise<UpdateHamtResult> => {
  if (parent.node.Data == null) {
    throw new Error('Could not update HAMT directory because parent had no data')
  }

  // update parent with new bit field
  const data = Uint8Array.from(bucket._children.bitField().reverse())
  const node = UnixFS.unmarshal(parent.node.Data)
  const dir = new UnixFS({
    type: 'hamt-sharded-directory',
    data,
    fanout: bucket.tableSize(),
    hashType: hamtHashCode,
    mode: node.mode,
    mtime: node.mtime
  })

  parent.node = {
    Data: dir.marshal(),
    Links: links.sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? ''))
  }
  const buf = dagPB.encode(parent.node)
  const hash = await sha256.digest(buf)
  const cid = CID.create(parent.cid.version, dagPB.code, hash)

  await blockstore.put(cid, buf, options)

  return {
    node: parent.node,
    cid,
    size: links.reduce((sum, link) => sum + (link.Tsize ?? 0), buf.length)
  }
}

export const recreateHamtLevel = async (blockstore: Blockstore, links: PBLink[], rootBucket: Bucket<any>, parentBucket: Bucket<any>, positionAtParent: number, options: AbortOptions): Promise<Bucket<any>> => {
  // recreate this level of the HAMT
  const bucket = new Bucket({
    hash: rootBucket._options.hash,
    bits: rootBucket._options.bits
  }, parentBucket, positionAtParent)
  parentBucket._putObjectAt(positionAtParent, bucket)

  await addLinksToHamtBucket(blockstore, links, bucket, rootBucket, options)

  return bucket
}

export const recreateInitialHamtLevel = async (links: PBLink[]): Promise<Bucket<any>> => {
  const bucket = createHAMT({
    hashFn: hamtHashFn,
    bits: hamtBucketBits
  })

  // populate sub bucket but do not recurse as we do not want to pull whole shard in
  await Promise.all(
    links.map(async link => {
      const linkName = (link.Name ?? '')

      if (linkName.length === 2) {
        const pos = parseInt(linkName, 16)

        const subBucket = new Bucket({
          hash: bucket._options.hash,
          bits: bucket._options.bits
        }, bucket, pos)
        bucket._putObjectAt(pos, subBucket)

        await Promise.resolve(); return
      }

      await bucket.put(linkName.substring(2), {
        size: link.Tsize,
        cid: link.Hash
      })
    })
  )

  return bucket
}

export const addLinksToHamtBucket = async (blockstore: Blockstore, links: PBLink[], bucket: Bucket<any>, rootBucket: Bucket<any>, options: AbortOptions): Promise<void> => {
  await Promise.all(
    links.map(async link => {
      const linkName = (link.Name ?? '')

      if (linkName.length === 2) {
        log('Populating sub bucket', linkName)
        const pos = parseInt(linkName, 16)
        const block = await blockstore.get(link.Hash, options)
        const node = dagPB.decode(block)

        const subBucket = new Bucket({
          hash: rootBucket._options.hash,
          bits: rootBucket._options.bits
        }, bucket, pos)
        bucket._putObjectAt(pos, subBucket)

        await addLinksToHamtBucket(blockstore, node.Links, subBucket, rootBucket, options)

        await Promise.resolve(); return
      }

      await rootBucket.put(linkName.substring(2), {
        size: link.Tsize,
        cid: link.Hash
      })
    })
  )
}

export const toPrefix = (position: number): string => {
  return position
    .toString(16)
    .toUpperCase()
    .padStart(2, '0')
    .substring(0, 2)
}

export interface HamtPath {
  rootBucket: Bucket<any>
  path: Array<{
    bucket: Bucket<any>
    prefix: string
    node?: PBNode
  }>
}

export const generatePath = async (parent: Directory, name: string, blockstore: Blockstore, options: AbortOptions): Promise<HamtPath> => {
  // start at the root bucket and descend, loading nodes as we go
  const rootBucket = await recreateInitialHamtLevel(parent.node.Links)
  const position = await rootBucket._findNewBucketAndPos(name)

  // the path to the root bucket
  const path: Array<{ bucket: Bucket<any>, prefix: string, node?: PBNode }> = [{
    bucket: position.bucket,
    prefix: toPrefix(position.pos)
  }]
  let currentBucket = position.bucket

  while (currentBucket !== rootBucket) {
    path.push({
      bucket: currentBucket,
      prefix: toPrefix(currentBucket._posAtParent)
    })

    // @ts-expect-error - only the root bucket's parent will be undefined
    currentBucket = currentBucket._parent
  }

  path.reverse()
  path[0].node = parent.node

  // load PbNode for each path segment
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]

    if (segment.node == null) {
      throw new Error('Could not generate HAMT path')
    }

    // find prefix in links
    const link = segment.node.Links
      .filter(link => (link.Name ?? '').substring(0, 2) === segment.prefix)
      .pop()

    // entry was not in shard
    if (link == null) {
      // reached bottom of tree, file will be added to the current bucket
      log(`Link ${segment.prefix}${name} will be added`)
      // return path
      continue
    }

    // found entry
    if (link.Name === `${segment.prefix}${name}`) {
      log(`Link ${segment.prefix}${name} will be replaced`)
      // file already existed, file will be added to the current bucket
      // return path
      continue
    }

    // found subshard
    log(`Found subshard ${segment.prefix}`)
    const block = await blockstore.get(link.Hash, options)
    const node = dagPB.decode(block)

    // subshard hasn't been loaded, descend to the next level of the HAMT
    if (path[i + 1] == null) {
      log(`Loaded new subshard ${segment.prefix}`)

      await recreateHamtLevel(blockstore, node.Links, rootBucket, segment.bucket, parseInt(segment.prefix, 16), options)
      const position = await rootBucket._findNewBucketAndPos(name)

      // i--
      path.push({
        bucket: position.bucket,
        prefix: toPrefix(position.pos),
        node
      })

      continue
    }

    const nextSegment = path[i + 1]

    // add intermediate links to bucket
    await addLinksToHamtBucket(blockstore, node.Links, nextSegment.bucket, rootBucket, options)

    nextSegment.node = node
  }

  await rootBucket.put(name, true)

  path.reverse()

  return {
    rootBucket,
    path
  }
}

export interface CreateShardOptions {
  mtime?: Mtime
  mode?: number
}

export const createShard = async (blockstore: Blockstore, contents: Array<{ name: string, size: number, cid: CID }>, options: CreateShardOptions = {}): Promise<ImportResult> => {
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
