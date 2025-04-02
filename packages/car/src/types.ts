import type { ExportCarOptions } from './index.js'
import type { CID } from 'multiformats/cid'

export interface StrategyResult {
  cid: CID
  strategy: TraversalStrategy
}

/**
 * Interface for different traversal strategies
 */
export interface TraversalStrategy {
  /**
   * Determine if the strategy should traverse the given CID
   */
  shouldTraverse(cid: CID, options?: ExportCarOptions): boolean

  /**
   * Get the next CID, and potentially new strategy to traverse
   */
  getNextCidStrategy(cid: CID, block: any): AsyncGenerator<StrategyResult, void, undefined>
}
