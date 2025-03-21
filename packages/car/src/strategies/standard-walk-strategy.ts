import { DAG_PB_CODEC_CODE } from '../constants.js'
import { type ExportCarOptions } from '../index.js'
import type { TraversalStrategy } from '../types.js'
import type { CID } from 'multiformats/cid'

/**
 * Strategy for standard DAG walking
 */
export class StandardWalkStrategy implements TraversalStrategy {
  private readonly roots: Set<CID>
  private emittedRoots: boolean = false

  constructor (roots: CID[] = []) {
    this.roots = new Set(roots)
  }

  shouldTraverse (cid: CID, options?: ExportCarOptions): boolean {
    // Apply dagScope rules for traversal
    if (options?.dagScope === 'block') {
      return false
    }

    if (options?.dagScope === 'entity' && cid.code !== DAG_PB_CODEC_CODE) {
      return false
    }

    return true
  }

  /**
   * When provided with multiple roots during initialization, we need to emit the roots first so that we are traversing all roots
   *
   * When other strategies return this strategy for use, we likely will not have multiple roots, so we will not emit the roots again
   */
  async * getNextCidStrategy (cid: CID, block: any): AsyncGenerator<CID, void, undefined> {
    if (!this.emittedRoots) {
      for (const root of this.roots) {
        if (!root.equals(cid)) {
          yield root
        }
      }
      this.emittedRoots = true
    }

    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
