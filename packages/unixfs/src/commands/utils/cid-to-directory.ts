import { exporter, type ExporterOptions } from 'ipfs-unixfs-exporter'
import { NotADirectoryError } from '../../errors.js'
import type { PBNode } from '@ipld/dag-pb'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export interface Directory {
  cid: CID
  node: PBNode
}

export async function cidToDirectory (cid: CID, blockstore: Blockstore, options: ExporterOptions = {}): Promise<Directory> {
  const entry = await exporter(cid, blockstore, options)

  if (entry.type !== 'directory') {
    throw new NotADirectoryError(`${cid.toString()} was not a UnixFS directory`)
  }

  return {
    cid,
    node: entry.node
  }
}
