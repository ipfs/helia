import type { TraversalStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'
import type { CID } from 'multiformats/cid'

/**
 * A traversal strategy that performs a breadth-first search (so as to not load blocks unnecessarily) looking for a
 * target CID. Traversal stops when we reach the target CID or run out of nodes.
 */
export class GraphSearch implements TraversalStrategy {
  private readonly target: CID

  constructor (target: CID) {
    this.target = target
  }

  isTarget (cid: CID): boolean {
    return this.target.equals(cid)
  }

  async * traverse <T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined> {
    for await (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
