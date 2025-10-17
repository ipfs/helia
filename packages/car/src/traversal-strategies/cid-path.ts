import toBuffer from 'it-to-buffer'
import { createUnsafe } from 'multiformats/block'
import { InvalidTraversalError, NotDescendantError } from '../errors.js'
import type { TraversalStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

/**
 * Simple strategy that traverses a known path to a target CID.
 *
 * All this strategy does is yield the next CID in the known path.
 *
 * The path should end with the CID to be exported
 */
export class CIDPath implements TraversalStrategy {
  private readonly path: CID[]

  constructor (path: CID[]) {
    this.path = path
  }

  async * traverse (root: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    if (!this.path.some(c => c.equals(root))) {
      throw new InvalidTraversalError(`CIDPath traversal must include ${root}`)
    }

    let parentBlock: BlockView<unknown, number, number, 0 | 1> | undefined

    for (const cid of this.path) {
      if (parentBlock != null) {
        let isChild = false

        for (const [, child] of parentBlock.links()) {
          if (child.equals(cid)) {
            isChild = true
            break
          }
        }

        if (!isChild) {
          throw new NotDescendantError(`${cid} is not a child of ${parentBlock.cid}`)
        }
      }

      const bytes = await toBuffer(blockstore.get(cid, options))
      const block = createUnsafe({
        cid,
        bytes,
        codec: await getCodec(cid.code)
      })

      parentBlock = block
      yield block
    }
  }
}
