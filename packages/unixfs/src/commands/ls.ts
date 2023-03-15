import { exporter, UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import type { LsOptions } from '../index.js'
import { resolve } from './utils/resolve.js'
import mergeOpts from 'merge-options'
import type { Blocks } from '@helia/interface/blocks'
import { NoContentError, NotADirectoryError } from './utils/errors.js'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })

const defaultOptions: LsOptions = {

}

export async function * ls (cid: CID, blockstore: Blocks, options: Partial<LsOptions> = {}): AsyncIterable<UnixFSEntry> {
  const opts: LsOptions = mergeOptions(defaultOptions, options)
  const resolved = await resolve(cid, opts.path, blockstore, opts)
  const result = await exporter(resolved.cid, blockstore)

  if (result.type === 'file' || result.type === 'raw') {
    yield result
    return
  }

  if (result.content == null) {
    throw new NoContentError()
  }

  if (result.type !== 'directory') {
    throw new NotADirectoryError()
  }

  yield * result.content({
    offset: options.offset,
    length: options.length
  })
}
