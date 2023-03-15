import { exporter, ExporterOptions } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import type { PBNode } from '@ipld/dag-pb'
import type { Blocks } from '@helia/interface/blocks'
import { NotADirectoryError } from './errors.js'

export interface Directory {
  cid: CID
  node: PBNode
}

export async function cidToDirectory (cid: CID, blockstore: Blocks, options: ExporterOptions = {}): Promise<Directory> {
  const entry = await exporter(cid, blockstore, options)

  if (entry.type !== 'directory') {
    throw new NotADirectoryError(`${cid.toString()} was not a UnixFS directory`)
  }

  return {
    cid,
    node: entry.node
  }
}
