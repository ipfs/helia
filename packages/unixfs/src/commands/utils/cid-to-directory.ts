import { NotADirectoryError } from '@helia/interface/errors'
import { Blockstore, exporter } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import type { PBNode } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interfaces'

export interface Directory {
  cid: CID
  node: PBNode
}

export async function cidToDirectory (cid: CID, blockstore: Blockstore, options: AbortOptions = {}): Promise<Directory> {
  const entry = await exporter(cid, blockstore, options)

  if (entry.type !== 'directory') {
    throw new NotADirectoryError(`${cid.toString()} was not a UnixFS directory`)
  }

  return {
    cid,
    node: entry.node
  }
}
