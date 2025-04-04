import { type BlockView } from 'multiformats/block/interface'
import { type TraversalStrategy } from '../index.js'
import type { CID } from 'multiformats/cid'

/**
 * Simple strategy that traverses a known path to a target CID.
 */
export class PathStrategy implements TraversalStrategy {
  private readonly pathToTarget: CID[]
  private readonly target: CID

  constructor (pathToTarget: CID[]) {
    this.pathToTarget = pathToTarget
    this.target = pathToTarget[pathToTarget.length - 1]
  }

  isTarget (cid: CID): boolean {
    return this.target.equals(cid)
  }

  /**
   * The CID that we are given here has already been added to the car file, so we don't need to add it again,
   * we need to return the next CID in the known path.
   *
   * If the next CID is the last CID in the known path, we need to return a new strategy to traverse the last CID.
   */
  async * traverse <T extends BlockView<any, any, any, 0 | 1>>(cid: CID, _block?: T): AsyncGenerator<CID, void, undefined> {
    const givenCidIndex = this.pathToTarget.indexOf(cid)
    const nextCid = this.pathToTarget[givenCidIndex + 1]

    yield nextCid
  }
}
