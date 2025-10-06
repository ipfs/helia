import { exporter } from 'ipfs-unixfs-exporter'
import { NoContentError, NotAFileError } from '../errors.js'
import { resolve } from './utils/resolve.js'
import type { CatOptions } from '../index.js'
import type { GetStore } from '../unixfs.js'
import type { CID } from 'multiformats/cid'

export async function * cat (cid: CID, blockstore: GetStore, options: Partial<CatOptions> = {}): AsyncIterable<Uint8Array> {
  const resolved = await resolve(cid, options.path, blockstore, options)
  const result = await exporter(resolved.cid, blockstore, options)

  if (result.type !== 'file' && result.type !== 'raw') {
    throw new NotAFileError()
  }

  if (result.content == null) {
    throw new NoContentError()
  }

  yield * result.content(options)
}
