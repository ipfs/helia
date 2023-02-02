import { NoContentError, NotAFileError } from '@helia/interface/errors'
import { Blockstore, exporter } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import type { CatOptions } from '../index.js'
import { resolve } from './utils/resolve.js'
import mergeOpts from 'merge-options'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })

const defaultOptions: CatOptions = {

}

export async function * cat (cid: CID, blockstore: Blockstore, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
  const opts: CatOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, opts.path, blockstore, opts)
  const result = await exporter(resolved.cid, blockstore, opts)

  if (result.type !== 'file' && result.type !== 'raw') {
    throw new NotAFileError()
  }

  if (result.content == null) {
    throw new NoContentError()
  }

  yield * result.content({
    offset: opts.offset,
    length: opts.length
  })
}
