import { type CID } from 'multiformats/cid'
import { type ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'

/**
 * Traverses the DAG breadth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class SubgraphExporter implements ExportStrategy {
  async * export (_cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
