import { unixfs } from '@helia/unixfs'
import * as dagPb from '@ipld/dag-pb'
import { importer } from 'ipfs-unixfs-importer'
import last from 'it-last'
import toBuffer from 'it-to-buffer'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export async function createSubShardedDirectory (blockstore: Blockstore, depth: number = 1, files: number = 5000): Promise<{
  importerCid: CID
  containingDirCid: CID
  fileName: string
}> {
  const fs = unixfs({ blockstore })
  const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
  let containingDirCid = await fs.addDirectory()
  let fileName: string | undefined
  let count = 0

  for (let i = 0; i < files; i++) {
    fileName = `file-${i}-${new Array(512).fill('0').join('')}.txt`

    containingDirCid = await fs.cp(fileCid, containingDirCid, fileName, {
      shardSplitThresholdBytes: 1
    })

    if (await searchCIDForSubShards(containingDirCid, blockstore, depth)) {
      count = i

      break
    }
  }

  if (fileName == null) {
    throw new Error('could not find file that would create a sub-shard')
  }

  // create a shard with the importer that is the same as the directory after we delete the file that causes a sub-shard to be created
  const importResult = await last(importer(
    new Array(count).fill(0).map((_, i) => {
      return {
        path: `file-${i}-${new Array(512).fill('0').join('')}.txt`,
        content: Uint8Array.from([0, 1, 2, 3, 4])
      }
    }), blockstore, {
      wrapWithDirectory: true,
      shardSplitThresholdBytes: 1
    }))

  if (importResult == null) {
    throw new Error('Nothing imported')
  }

  const { cid: importerCid } = importResult

  return {
    importerCid,
    containingDirCid,
    fileName
  }
}

async function searchCIDForSubShards (cid: CID, blockstore: Blockstore, depth: number = 1): Promise<boolean> {
  const block = await toBuffer(blockstore.get(cid))
  const node = dagPb.decode(block)

  // search links for sub-shard
  for (const link of node.Links) {
    if (link.Name?.length === 2) {
      const block = await toBuffer(blockstore.get(link.Hash))
      const node = dagPb.decode(block)
      const firstLink = node.Links[1]

      if (firstLink == null) {
        throw new Error('Sub-shard had no child links')
      }

      if (firstLink.Name == null) {
        throw new Error('Sub-shard child had no name')
      }

      if (depth === 1) {
        return true
      }

      if (await searchCIDForSubShards(link.Hash, blockstore, depth - 1)) {
        return true
      }
    }
  }

  return false
}
