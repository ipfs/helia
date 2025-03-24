import type { CID } from 'multiformats/cid'

export class BlockNotFoundError extends Error {
  constructor (cid: CID) {
    super(`block ${cid.toString()} not found in blockstore`)
    this.name = 'BlockNotFoundError'
  }
}
