import { Blockstore, exporter } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'
import { NotUnixFSError } from './errors.js'
import * as dagPb from '@ipld/dag-pb'
import type { PBNode, PBLink } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interfaces'

export async function cidToPBLink (cid: CID, name: string, blockstore: Blockstore, options?: AbortOptions): Promise<Required<PBLink>> {
  const sourceEntry = await exporter(cid, blockstore, options)

  if (sourceEntry.type !== 'directory' && sourceEntry.type !== 'file' && sourceEntry.type !== 'raw') {
    throw new NotUnixFSError(`${cid.toString()} was not a UnixFS node`)
  }

  return {
    Name: name,
    Tsize: sourceEntry.node instanceof Uint8Array ? sourceEntry.node.byteLength : dagNodeTsize(sourceEntry.node),
    Hash: cid
  }
}

function dagNodeTsize (node: PBNode): number {
  const linkSizes = node.Links.reduce((acc, curr) => acc + (curr.Tsize ?? 0), 0)

  return dagPb.encode(node).byteLength + linkSizes
}
