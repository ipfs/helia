import { mergeOptions as mergeOpts } from '@libp2p/utils/merge-options'
import { exporter } from 'ipfs-unixfs-exporter'
import { NoContentError, NotADirectoryError } from '../errors.js'
import { resolve } from './utils/resolve.js'
import type { LsOptions } from '../index.js'
import type { GetStore } from '../unixfs.js'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })

const defaultOptions: LsOptions = {

}

export async function * ls (cid: CID, blockstore: GetStore, options: Partial<LsOptions> = {}): AsyncIterable<UnixFSEntry> {
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
