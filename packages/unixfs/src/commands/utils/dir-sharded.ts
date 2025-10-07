import { encode, prepare } from '@ipld/dag-pb'
import { createHAMT, Bucket } from 'hamt-sharding'
import { UnixFS } from 'ipfs-unixfs'
import { CID } from 'multiformats/cid'
import {
  hamtHashCode,
  hamtHashFn
} from './hamt-constants.js'
import { persist } from './persist.js'
import type { PersistOptions } from './persist.js'
import type { PutStore } from '../../unixfs.js'
import type { PBLink } from '@ipld/dag-pb'
import type { BucketChild } from 'hamt-sharding'
import type { Mtime } from 'ipfs-unixfs'

interface InProgressImportResult extends ImportResult {
  single?: boolean
  originalPath?: string
}

interface ImportResult {
  cid: CID
  size: bigint
  path?: string
  unixfs?: UnixFS
}

interface DirProps {
  root: boolean
  dir: boolean
  path: string
  dirty: boolean
  flat: boolean
  parent?: Dir
  parentKey?: string
  unixfs?: UnixFS
  mode?: number
  mtime?: Mtime
}

abstract class Dir {
  public options: PersistOptions
  public root: boolean
  public dir: boolean
  public path: string
  public dirty: boolean
  public flat: boolean
  public parent?: Dir
  public parentKey?: string
  public unixfs?: UnixFS
  public mode?: number
  public mtime?: Mtime
  public cid?: CID
  public size?: number
  public nodeSize?: number

  constructor (props: DirProps, options: PersistOptions) {
    this.options = options ?? {}

    this.root = props.root
    this.dir = props.dir
    this.path = props.path
    this.dirty = props.dirty
    this.flat = props.flat
    this.parent = props.parent
    this.parentKey = props.parentKey
    this.unixfs = props.unixfs
    this.mode = props.mode
    this.mtime = props.mtime
  }

  abstract put (name: string, value: InProgressImportResult | Dir): Promise<void>
  abstract get (name: string): Promise<InProgressImportResult | Dir | undefined>
  abstract eachChildSeries (): AsyncIterable<{ key: string, child: InProgressImportResult | Dir }>
  abstract flush (blockstore: PutStore): AsyncGenerator<ImportResult>
  abstract estimateNodeSize (): number
  abstract childCount (): number
}

export class DirSharded extends Dir {
  public _bucket: Bucket<InProgressImportResult | Dir>

  constructor (props: DirProps, options: PersistOptions) {
    super(props, options)

    this._bucket = createHAMT({
      hashFn: hamtHashFn,
      bits: 8
    })
  }

  async put (name: string, value: InProgressImportResult | Dir): Promise<void> {
    this.cid = undefined
    this.size = undefined
    this.nodeSize = undefined

    await this._bucket.put(name, value)
  }

  async get (name: string): Promise<InProgressImportResult | Dir | undefined> {
    return this._bucket.get(name)
  }

  childCount (): number {
    return this._bucket.leafCount()
  }

  directChildrenCount (): number {
    return this._bucket.childrenCount()
  }

  onlyChild (): Bucket<InProgressImportResult | Dir> | BucketChild<InProgressImportResult | Dir> {
    return this._bucket.onlyChild()
  }

  async * eachChildSeries (): AsyncGenerator<{ key: string, child: InProgressImportResult | Dir }> {
    for (const { key, value } of this._bucket.eachLeafSeries()) {
      yield {
        key,
        child: value
      }
    }
  }

  estimateNodeSize (): number {
    if (this.nodeSize !== undefined) {
      return this.nodeSize
    }

    this.nodeSize = calculateSize(this._bucket, this, this.options)

    return this.nodeSize
  }

  async * flush (blockstore: PutStore): AsyncGenerator<ImportResult> {
    for await (const entry of flush(this._bucket, blockstore, this, this.options)) {
      yield {
        ...entry,
        path: this.path
      }
    }
  }
}

async function * flush (bucket: Bucket<Dir | InProgressImportResult>, blockstore: PutStore, shardRoot: DirSharded | null, options: PersistOptions): AsyncIterable<ImportResult> {
  const children = bucket._children
  const links: PBLink[] = []
  let childrenSize = 0n

  for (let i = 0; i < children.length; i++) {
    const child = children.get(i)

    if (child == null) {
      continue
    }

    const labelPrefix = i.toString(16).toUpperCase().padStart(2, '0')

    if (child instanceof Bucket) {
      let shard

      for await (const subShard of flush(child, blockstore, null, options)) {
        shard = subShard
      }

      if (shard == null) {
        throw new Error('Could not flush sharded directory, no sub-shard found')
      }

      links.push({
        Name: labelPrefix,
        Tsize: Number(shard.size),
        Hash: shard.cid
      })
      childrenSize += shard.size
    } else if (isDir(child.value)) {
      const dir = child.value
      let flushedDir: ImportResult | undefined

      for await (const entry of dir.flush(blockstore)) {
        flushedDir = entry

        yield flushedDir
      }

      if (flushedDir == null) {
        throw new Error('Did not flush dir')
      }

      const label = labelPrefix + child.key
      links.push({
        Name: label,
        Tsize: Number(flushedDir.size),
        Hash: flushedDir.cid
      })

      childrenSize += flushedDir.size
    } else {
      const value = child.value

      if (value.cid == null) {
        continue
      }

      const label = labelPrefix + child.key
      const size = value.size

      links.push({
        Name: label,
        Tsize: Number(size),
        Hash: value.cid
      })
      childrenSize += BigInt(size ?? 0)
    }
  }

  // go-ipfs uses little endian, that's why we have to
  // reverse the bit field before storing it
  const data = Uint8Array.from(children.bitField().reverse())
  const dir = new UnixFS({
    type: 'hamt-sharded-directory',
    data,
    fanout: BigInt(bucket.tableSize()),
    hashType: hamtHashCode,
    mtime: shardRoot?.mtime,
    mode: shardRoot?.mode
  })

  const node = {
    Data: dir.marshal(),
    Links: links
  }
  const buffer = encode(prepare(node))
  const cid = await persist(buffer, blockstore, options)
  const size = BigInt(buffer.byteLength) + childrenSize

  yield {
    cid,
    unixfs: dir,
    size
  }
}

function isDir (obj: any): obj is Dir {
  return typeof obj.flush === 'function'
}

function calculateSize (bucket: Bucket<any>, shardRoot: DirSharded | null, options: PersistOptions): number {
  const children = bucket._children
  const links: PBLink[] = []

  for (let i = 0; i < children.length; i++) {
    const child = children.get(i)

    if (child == null) {
      continue
    }

    const labelPrefix = i.toString(16).toUpperCase().padStart(2, '0')

    if (child instanceof Bucket) {
      const size = calculateSize(child, null, options)

      links.push({
        Name: labelPrefix,
        Tsize: Number(size),
        Hash: options.cidVersion === 0 ? CID_V0 : CID_V1
      })
    } else if (typeof child.value.flush === 'function') {
      const dir = child.value
      const size = dir.nodeSize()

      links.push({
        Name: labelPrefix + child.key,
        Tsize: Number(size),
        Hash: options.cidVersion === 0 ? CID_V0 : CID_V1
      })
    } else {
      const value = child.value

      if (value.cid == null) {
        continue
      }

      const label = labelPrefix + child.key
      const size = value.size

      links.push({
        Name: label,
        Tsize: Number(size),
        Hash: value.cid
      })
    }
  }

  // go-ipfs uses little endian, that's why we have to
  // reverse the bit field before storing it
  const data = Uint8Array.from(children.bitField().reverse())
  const dir = new UnixFS({
    type: 'hamt-sharded-directory',
    data,
    fanout: BigInt(bucket.tableSize()),
    hashType: hamtHashCode,
    mtime: shardRoot?.mtime,
    mode: shardRoot?.mode
  })

  const buffer = encode(prepare({
    Data: dir.marshal(),
    Links: links
  }))

  return buffer.length
}

// we use these to calculate the node size to use as a check for whether a directory
// should be sharded or not. Since CIDs have a constant length and We're only
// interested in the data length and not the actual content identifier we can use
// any old CID instead of having to hash the data which is expensive.
export const CID_V0 = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
export const CID_V1 = CID.parse('zdj7WbTaiJT1fgatdet9Ei9iDB5hdCxkbVyhyh8YTUnXMiwYi')
