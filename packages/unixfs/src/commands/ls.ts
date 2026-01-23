import { exporter } from 'ipfs-unixfs-exporter'
import { resolve } from './utils/resolve.js'
import type { LsOptions } from '../index.js'
import type { GetStore } from '../unixfs.js'
import type { UnixFSDirectoryEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

export async function * ls (cid: CID, blockstore: GetStore, options: Partial<LsOptions> = {}): AsyncIterable<UnixFSDirectoryEntry> {
  const resolved = await resolve(cid, options.path, blockstore, options)
  const result = await exporter(resolved.cid, blockstore, options)

  if (result.type === 'directory') {
    yield * result.entries(options)
    return
  }

  yield result
}
