import { type CID } from 'multiformats/cid'
import { DAG_PB_CODEC_CODE } from '../constants.js'
import { type ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'

/**
 * This exporter is used when you want to generate a car file for dag-scope=entity
 *
 * For queries that traverse UnixFS data, entity roughly means return blocks needed to verify the terminating element of
 * the requested content path. For UnixFS, all the blocks needed to read an entire UnixFS file, or enumerate a UnixFS
 * directory. For all queries that reference non-UnixFS data, entity is equivalent to block
 */
export class EntityExporter implements ExportStrategy {
  async * traverse (cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    // if the block is a UnixFS file, yield all the blocks needed to read the file

    if (cid.code === DAG_PB_CODEC_CODE) {
      // yield * []
      // we need to yield all blocks in the tree for the node
      for await (const [, linkedCid] of block.links()) {
        yield linkedCid
      }
    } else {
      // dag-scope=block because we want to yield only the block for the non-UnixFS data
      // yield * []
    }
  }
}
