import type { Blockstore } from 'interface-blockstore'
import { importBytes, importer } from 'ipfs-unixfs-importer'
import { CID } from 'multiformats/cid'
import { unixfs } from '../../src/index.js'
import * as dagPb from '@ipld/dag-pb'
import last from 'it-last'

export async function createSubshardedDirectory (blockstore: Blockstore, depth: number = 1, files: number = 5000): Promise<{
  importerCid: CID
  containingDirCid: CID
  fileName: string
}> {
  const fs = unixfs({ blockstore })

  const { cid: fileCid } = await importBytes(Uint8Array.from([0, 1, 2, 3, 4]), blockstore)
  let containingDirCid = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  let fileName: string | undefined
  let count = 0

  for (let i = 0; i < files; i++) {
    fileName = `file-${i}-${new Array(512).fill('0').join('')}.txt`

    containingDirCid = await fs.cp(fileCid, containingDirCid, fileName, {
      shardSplitThresholdBytes: 1
    })

    if (await searchCIDForSubshards(containingDirCid, blockstore, depth)) {
      count = i

      break
    }
  }

  if (fileName == null) {
    throw new Error('could not find file that would create a subshard')
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

async function searchCIDForSubshards (cid: CID, blockstore: Blockstore, depth: number = 1): Promise<boolean> {
  const block = await blockstore.get(cid)
  const node = dagPb.decode(block)

  // search links for subshard
  for (const link of node.Links) {
    if (link.Name?.length === 2) {
      const block = await blockstore.get(link.Hash)
      const node = dagPb.decode(block)
      const firstLink = node.Links[1]

      if (firstLink == null) {
        throw new Error('Subshard had no child links')
      }

      if (firstLink.Name == null) {
        throw new Error('Subshard child had no name')
      }

      if (depth === 1) {
        return true
      }

      if (await searchCIDForSubshards(link.Hash, blockstore, depth - 1)) {
        return true
      }
    }
  }

  return false
}
