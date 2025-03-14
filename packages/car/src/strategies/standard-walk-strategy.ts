import { DAG_PB_CODEC_CODE } from '../constants.js'
import { DagScope, type ExportCarOptions } from '../index.js'
import type { TraversalStrategy } from '../types.js'
import type { CID } from 'multiformats/cid'

/**
 * Strategy for standard DAG walking
 */
export class StandardWalkStrategy implements TraversalStrategy {
  shouldTraverse (cid: CID, options?: ExportCarOptions): boolean {
    // Apply dagScope rules for traversal
    if (options?.dagScope === DagScope.BLOCK) {
      return false
    }

    if (options?.dagScope === DagScope.ENTITY && cid.code !== DAG_PB_CODEC_CODE) {
      return false
    }

    return true
  }

  async * getNextCidStrategy (cid: CID, block: any): AsyncGenerator<CID, void, undefined> {
    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
