import { DAG_PB_CODEC_CODE } from '../constants.js'
import { DagScope } from '../dag-scope.js'
import { StandardWalkStrategy } from './standard-walk-strategy.js'
import type { ExportCarOptions, TraversalStrategy } from '../types.js'
import type { CID } from 'multiformats/cid'

/**
 * Strategy for finding paths to target roots
 */
export class PathFindingStrategy implements TraversalStrategy {
  private readonly targetRoots: CID[]

  constructor (targetRoots: CID[]) {
    this.targetRoots = targetRoots
  }

  shouldTraverse (cid: CID, options?: ExportCarOptions): boolean {
    const isTargetRoot = this.targetRoots.some(r => r.equals(cid))

    if (isTargetRoot) {
      if (options?.dagScope === DagScope.BLOCK) {
        return false
      }

      if (options?.dagScope === DagScope.ENTITY && cid.code !== DAG_PB_CODEC_CODE) {
        return false
      }
    }

    return true
  }

  async * getNextCidStrategy (cid: CID, block: any): AsyncGenerator<{ cid: CID, strategy: TraversalStrategy }, void, undefined> {
    const isTargetRoot = this.targetRoots.some(r => r.equals(cid))

    for await (const [, linkedCid] of block.links()) {
      yield {
        cid: linkedCid,
        strategy: isTargetRoot ? new StandardWalkStrategy() : this
      }
    }
  }
}
