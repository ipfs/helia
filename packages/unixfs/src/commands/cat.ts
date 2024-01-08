import { exporter } from 'ipfs-unixfs-exporter'
import mergeOpts from 'merge-options'
import { NoContentError, NotAFileError } from '../errors.js'
import { resolve } from './utils/resolve.js'
import type { CatOptions } from '../index.js'
import type { Blocks } from '@helia/interface/blocks'
import type { CID } from 'multiformats/cid'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })

const defaultOptions: CatOptions = {

}

export async function * cat (cid: CID, blockstore: Blocks, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
  const opts: CatOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, opts.path, blockstore, opts)
  const result = await exporter(resolved.cid, blockstore, opts)

  if (result.type !== 'file' && result.type !== 'raw') {
    throw new NotAFileError()
  }

  if (result.content == null) {
    throw new NoContentError()
  }

  yield * result.content(opts)
}
