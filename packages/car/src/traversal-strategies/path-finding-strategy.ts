// import { DAG_PB_CODEC_CODE } from '../constants.js'
// import { StandardWalkStrategy } from './standard-walk-strategy.js'
// import type { ExportCarOptions } from '../index.js'
// import type { StrategyResult, TraversalStrategy } from '../types.js'
import type { TraversalStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'
import type { CID } from 'multiformats/cid'

/**
 * Strategy for finding paths to target roots
 */
export class PathFindingStrategy implements TraversalStrategy {
  private readonly targetRoots: CID[]

  constructor (targetRoots: CID[]) {
    this.targetRoots = targetRoots
  }

  // shouldTraverse (cid: CID, options?: ExportCarOptions): boolean {
  //   const isTargetRoot = this.targetRoots.some(r => r.equals(cid))

  //   if (isTargetRoot) {
  //     if (options?.dagScope === 'block') {
  //       return false
  //     }

  //     if (options?.dagScope === 'entity' && cid.code !== DAG_PB_CODEC_CODE) {
  //       return false
  //     }
  //   }

  //   return true
  // }

  isTarget (cid: CID): boolean {
    return this.targetRoots.some(r => r.equals(cid))
  }

  async * traverse <T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined> {
    // const isTargetRoot = this.targetRoots.some(r => r.equals(cid))

    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
      // yield {
      //   cid: linkedCid,
      //   strategy: isTargetRoot ? new StandardWalkStrategy() : this
      // }
    }
  }
}
