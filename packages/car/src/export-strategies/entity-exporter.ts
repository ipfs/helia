import { type CID } from 'multiformats/cid'
import { type ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'

/**
 * Yields the first block from the first CID and stops.
 *
 * This exporter is useful for dag-scope=entity
 */
export class EntityExporter implements ExportStrategy {
  async * traverse (cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    yield cid
  }
}
