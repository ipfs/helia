import { type ExportCarOptions } from '../index.js'
import { StandardWalkStrategy } from './standard-walk-strategy.js'
import type { TraversalStrategy } from '../types.js'
import type { CID } from 'multiformats/cid'

/**
 * Strategy for standard DAG walking
 */
export class KnownPathStrategy implements TraversalStrategy {
  private readonly knownPath: CID[]

  constructor (knownPath: CID[]) {
    this.knownPath = knownPath
  }

  shouldTraverse (cid: CID, _options?: ExportCarOptions): boolean {
    return this.knownPath.includes(cid) && this.knownPath.indexOf(cid) !== this.knownPath.length - 1
  }

  /**
   * The CID that we are given here has already been added to the car file, so we don't need to add it again,
   * we need to return the next CID in the known path.
   *
   * If the next CID is the last CID in the known path, we need to return a new strategy to traverse the last CID.
   */
  async * getNextCidStrategy (cid: CID, _block: any): AsyncGenerator<CID | { cid: CID, strategy: TraversalStrategy }, void, undefined> {
    const givenCidIndex = this.knownPath.indexOf(cid)
    const nextCid = this.knownPath[givenCidIndex + 1]

    if (nextCid === this.knownPath[this.knownPath.length - 1]) {
      yield {
        cid: nextCid,
        strategy: new StandardWalkStrategy()
      }
    } else {
      yield nextCid
    }
  }
}
