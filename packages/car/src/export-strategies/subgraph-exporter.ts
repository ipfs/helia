import { type CID } from 'multiformats/cid'
import { type ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'

/**
 * Traverses the DAG depth-first starting at the target CID and yields all encountered blocks.
 * Can use parallelism to speed up loading blocks but should yield them in order.
 *
 * The target CID could be a UnixFS file, in which case the CAR would hold just that file, or it could be a UnixFS directory in which case the CAR would hold the whole directory.
 * It could be a DAG-CBOR block in which case the CAR would hold the root CBOR block and all linked blocks.
 */
export class SubgraphExporter implements ExportStrategy {
  async * traverse (_cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    // DFS
    // const links = []
    // for await (const [, linkedCid] of block.links()) {
    //   links.push(linkedCid)
    // }

    // for (let i = links.length - 1; i >= 0; i--) {
    //   yield links[i]
    // }

    // BFS
    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
