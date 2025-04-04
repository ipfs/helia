import { type CID } from 'multiformats/cid'
import { type ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'

/**
 * Yields the first block from the first CID and stops.
 *
 * This exporter is useful for dag-scope=block
 */
export class BlockExporter implements ExportStrategy {
  async * traverse (cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    // don't yield the block, index.ts will add it to the car file and then we're done...
  }
}
