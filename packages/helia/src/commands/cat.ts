import mergeOpts from 'merge-options'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats'
import type { CatOptions } from '../index.js'
import type { ReadableStream } from 'node:stream/web'
import type { FileSystem } from '@helia/interface'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })

const defaultOptions: CatOptions = {
  offset: 0,
  length: Infinity
}

interface CatComponents {
  blockstore: Blockstore
  filesystems: FileSystem[]
}

export function createCat (components: CatComponents) {
  return function cat (cid: CID, options: CatOptions = {}): ReadableStream<Uint8Array> {
    options = mergeOptions(defaultOptions, options)

    return components.filesystems[0].cat(cid, options)
  }
}
