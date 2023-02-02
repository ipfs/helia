import { encode, prepare } from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs'
import { persist } from './persist.js'
import { createHAMT, Bucket, BucketChild } from 'hamt-sharding'
import {
  hamtHashCode,
  hamtHashFn,
  hamtBucketBits
} from './hamt-constants.js'
import type { CID, Version } from 'multiformats/cid'
import type { PBNode } from '@ipld/dag-pb/interface'
import type { Mtime } from 'ipfs-unixfs'
import type { BlockCodec } from 'multiformats/codecs/interface'
import type { Blockstore } from 'ipfs-unixfs-importer'

export interface ImportResult {
  cid: CID
  node: PBNode
  size: number
}

export interface DirContents {
  cid?: CID
  size?: number
}

export interface DirOptions {
  mtime?: Mtime
  mode?: number
  codec?: BlockCodec<any, any>
  cidVersion?: Version
  onlyHash?: boolean
  signal?: AbortSignal
}

export interface DirProps {
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

export abstract class Dir {
  protected options: DirOptions
  protected root: boolean
  protected dir: boolean
  protected path: string
  protected dirty: boolean
  protected flat: boolean
  protected parent?: Dir
  protected parentKey?: string
  protected unixfs?: UnixFS
  protected mode?: number
  public mtime?: Mtime
  protected cid?: CID
  protected size?: number

  constructor (props: DirProps, options: DirOptions) {
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
}

export class DirSharded extends Dir {
  public _bucket: Bucket<DirContents>

  constructor (props: DirProps, options: DirOptions) {
    super(props, options)

    /** @type {Bucket<DirContents>} */
    this._bucket = createHAMT({
      hashFn: hamtHashFn,
      bits: hamtBucketBits
    })
  }

  async put (name: string, value: DirContents): Promise<void> {
    await this._bucket.put(name, value)
  }

  async get (name: string): Promise<DirContents | undefined> {
    return await this._bucket.get(name)
  }

  childCount (): number {
    return this._bucket.leafCount()
  }

  directChildrenCount (): number {
    return this._bucket.childrenCount()
  }

  onlyChild (): Bucket<DirContents> | BucketChild<DirContents> {
    return this._bucket.onlyChild()
  }

  async * eachChildSeries (): AsyncGenerator<{ key: string, child: DirContents }> {
    for await (const { key, value } of this._bucket.eachLeafSeries()) {
      yield {
        key,
        child: value
      }
    }
  }

  async * flush (blockstore: Blockstore): AsyncIterable<ImportResult> {
    yield * flush(this._bucket, blockstore, this, this.options)
  }
}

async function * flush (bucket: Bucket<any>, blockstore: Blockstore, shardRoot: any, options: DirOptions): AsyncIterable<ImportResult> {
  const children = bucket._children
  const links = []
  let childrenSize = 0

  for (let i = 0; i < children.length; i++) {
    const child = children.get(i)

    if (child == null) {
      continue
    }

    const labelPrefix = i.toString(16).toUpperCase().padStart(2, '0')

    if (child instanceof Bucket) {
      let shard: ImportResult | undefined

      for await (const subShard of flush(child, blockstore, null, options)) {
        shard = subShard
      }

      if (shard == null) {
        throw new Error('Could not flush sharded directory, no subshard found')
      }

      links.push({
        Name: labelPrefix,
        Tsize: shard.size,
        Hash: shard.cid
      })
      childrenSize += shard.size
    } else if (typeof child.value.flush === 'function') {
      const dir = child.value
      let flushedDir

      for await (const entry of dir.flush(blockstore)) {
        flushedDir = entry

        yield flushedDir
      }

      const label = labelPrefix + child.key
      links.push({
        Name: label,
        Tsize: flushedDir.size,
        Hash: flushedDir.cid
      })

      childrenSize += flushedDir.size // eslint-disable-line @typescript-eslint/restrict-plus-operands
    } else {
      const value = child.value

      if (value.cid == null) {
        continue
      }

      const label = labelPrefix + child.key
      const size = value.size

      links.push({
        Name: label,
        Tsize: size,
        Hash: value.cid
      })
      childrenSize += size ?? 0 // eslint-disable-line @typescript-eslint/restrict-plus-operands
    }
  }

  // go-ipfs uses little endian, that's why we have to
  // reverse the bit field before storing it
  const data = Uint8Array.from(children.bitField().reverse())
  const dir = new UnixFS({
    type: 'hamt-sharded-directory',
    data,
    fanout: bucket.tableSize(),
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
  const size = buffer.length + childrenSize

  yield {
    cid,
    node,
    size
  }
}
