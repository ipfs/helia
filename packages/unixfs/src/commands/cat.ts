import { exporter } from 'ipfs-unixfs-exporter'
import { NoContentError, NotAFileError } from '../errors.ts'
import { resolve } from './utils/resolve.ts'
import type { CatOptions } from '../index.ts'
import type { GetStore } from '../unixfs.ts'
import type { CID } from 'multiformats/cid'

export async function * cat (cid: CID, blockstore: GetStore, options: CatOptions = {}): AsyncIterable<Uint8Array> {
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
