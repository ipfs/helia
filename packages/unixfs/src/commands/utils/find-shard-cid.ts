import { decode, type PBLink, type PBNode } from '@ipld/dag-pb'
import { murmur3128 } from '@multiformats/murmur3'
import errCode from 'err-code'
import { Bucket, type BucketPosition, createHAMT } from 'hamt-sharding'
import { UnixFS } from 'ipfs-unixfs'
import type { ExporterOptions, ReadableStorage, ShardTraversalContext } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

// FIXME: this is copy/pasted from ipfs-unixfs-importer/src/options.js
const hashFn = async function (buf: Uint8Array): Promise<Uint8Array> {
  return (await murmur3128.encode(buf))
    // Murmur3 outputs 128 bit but, accidentally, IPFS Go's
    // implementation only uses the first 64, so we must do the same
    // for parity..
    .slice(0, 8)
    // Invert buffer because that's how Go impl does it
    .reverse()
}

const addLinksToHamtBucket = async (links: PBLink[], bucket: Bucket<boolean>, rootBucket: Bucket<boolean>): Promise<void> => {
  const padLength = (bucket.tableSize() - 1).toString(16).length
  await Promise.all(
    links.map(async link => {
      if (link.Name == null) {
        // TODO(@rvagg): what do? this is technically possible
        throw new Error('Unexpected Link without a Name')
      }
      if (link.Name.length === padLength) {
        const pos = parseInt(link.Name, 16)

        bucket._putObjectAt(pos, new Bucket({
          hash: rootBucket._options.hash,
          bits: rootBucket._options.bits
        }, bucket, pos))
        return
      }

      await rootBucket.put(link.Name.substring(2), true)
    })
  )
}

const toPrefix = (position: number, padLength: number): string => {
  return position
    .toString(16)
    .toUpperCase()
    .padStart(padLength, '0')
    .substring(0, padLength)
}

const toBucketPath = (position: BucketPosition<boolean>): Array<Bucket<boolean>> => {
  let bucket = position.bucket
  const path = []

  while (bucket._parent != null) {
    path.push(bucket)

    bucket = bucket._parent
  }

  path.push(bucket)

  return path.reverse()
}

export async function findShardCid (node: PBNode, name: string, blockstore: ReadableStorage, context?: ShardTraversalContext, options?: ExporterOptions): Promise<CID | undefined> {
  if (context == null) {
    if (node.Data == null) {
      throw errCode(new Error('no data in PBNode'), 'ERR_NOT_UNIXFS')
    }

    let dir: UnixFS
    try {
      dir = UnixFS.unmarshal(node.Data)
    } catch (err: any) {
      throw errCode(err, 'ERR_NOT_UNIXFS')
    }

    if (dir.type !== 'hamt-sharded-directory') {
      throw errCode(new Error('not a HAMT'), 'ERR_NOT_UNIXFS')
    }
    if (dir.fanout == null) {
      throw errCode(new Error('missing fanout'), 'ERR_NOT_UNIXFS')
    }

    const rootBucket = createHAMT<boolean>({
      hashFn,
      bits: Math.log2(Number(dir.fanout))
    })

    context = {
      rootBucket,
      hamtDepth: 1,
      lastBucket: rootBucket
    }
  }

  const padLength = (context.lastBucket.tableSize() - 1).toString(16).length

  await addLinksToHamtBucket(node.Links, context.lastBucket, context.rootBucket)

  const position = await context.rootBucket._findNewBucketAndPos(name)
  let prefix = toPrefix(position.pos, padLength)
  const bucketPath = toBucketPath(position)

  if (bucketPath.length > context.hamtDepth) {
    context.lastBucket = bucketPath[context.hamtDepth]

    prefix = toPrefix(context.lastBucket._posAtParent, padLength)
  }

  const link = node.Links.find(link => {
    if (link.Name == null) {
      return false
    }

    const entryPrefix = link.Name.substring(0, padLength)
    const entryName = link.Name.substring(padLength)

    if (entryPrefix !== prefix) {
      // not the entry or subshard we're looking for
      return false
    }

    if (entryName !== '' && entryName !== name) {
      // not the entry we're looking for
      return false
    }

    return true
  })

  if (link == null) {
    return
  }

  if (link.Name != null && link.Name.substring(padLength) === name) {
    return link.Hash
  }

  context.hamtDepth++

  const block = await blockstore.get(link.Hash, options)
  node = decode(block)

  return findShardCid(node, name, blockstore, context, options)
}
