import type { Blockstore } from 'interface-blockstore'
import { UnixFS } from 'ipfs-unixfs'
import type { CID } from 'multiformats/cid'
import * as dagPb from '@ipld/dag-pb'
import * as raw from 'multiformats/codecs/raw'

type GetStore = Pick<Blockstore, 'get'>

export async function printTree (cid: CID, blockstore: GetStore, name: string = '', indent: string = ''): Promise<void> {
  const block = await blockstore.get(cid)

  if (cid.code === dagPb.code) {
    const node = dagPb.decode(block)

    if (node.Data == null) {
      return
    }

    const unixfs = UnixFS.unmarshal(node.Data)

    console.info(indent, cid.toString(), name, unixfs.type) // eslint-disable-line no-console

    for (const link of node.Links) {
      let name = link.Name ?? ''

      if (name.length > 12) {
        name = name.substring(0, 12) + '...'
      }

      await printTree(link.Hash, blockstore, name, `${indent}  `)
    }
  } else if (cid.code === raw.code) {
    console.info(indent, cid.toString(), name, 'dag-raw') // eslint-disable-line no-console
  }
}
