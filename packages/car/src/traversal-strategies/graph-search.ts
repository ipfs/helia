import { breadthFirstWalker, depthFirstWalker } from '@helia/utils'
import { InvalidParametersError } from '@libp2p/interface'
import toBuffer from 'it-to-buffer'
import { createUnsafe } from 'multiformats/block'
import { InvalidTraversalError } from '../errors.ts'
import type { TraversalStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { GraphWalker, GraphWalkerComponents } from '@helia/utils'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

export interface GraphSearchOptions {
  /**
   * Graph traversal strategy, defaults to breadth-first
   */
  walker?: (components: GraphWalkerComponents) => GraphWalker

  /**
   * How to search the graph
   *
   * @deprecated use `walker` instead - this will be removed in a future release
   */
  strategy?: 'depth-first' | 'breadth-first'
}

function isCID (obj?: any): obj is CID {
  return obj != null && obj?.asCID === obj
}

/**
 * A traversal strategy that performs a depth-first search looking for a target
 * CID.
 */
export class GraphSearch implements TraversalStrategy {
  private haystack?: CID
  private readonly needle: CID
  private readonly options?: GraphSearchOptions
  private walker?: (components: GraphWalkerComponents) => GraphWalker

  constructor (needle: CID, options?: GraphSearchOptions)
  constructor (haystack: CID, needle: CID, options?: GraphSearchOptions)
  constructor (...args: any[]) {
    if (isCID(args[0])) {
      if (isCID(args[1])) {
        this.haystack = args[0]
        this.needle = args[1]
        this.options = args[2]
      } else {
        this.needle = args[0]
        this.options = args[1]
      }
    } else {
      throw new InvalidParametersError('needle must be specified')
    }

    this.walker = this.options?.walker
  }

  async * traverse (root: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    const start = this.haystack ?? root
    let walker: GraphWalker
    const components = {
      blockstore,
      getCodec
    }

    if (this.walker != null) {
      walker = this.walker(components)
    } else if (this.options?.strategy === 'breadth-first') {
      walker = breadthFirstWalker()(components)
    } else {
      walker = depthFirstWalker()(components)
    }

    for await (const node of walker.walk(start, options)) {
      if (node.block.cid.equals(this.needle)) {
        for (const cid of node.path) {
          const bytes = await toBuffer(blockstore.get(cid, options))
          const block = createUnsafe({
            cid,
            bytes,
            codec: await getCodec(cid.code)
          })

          yield block
        }

        return
      }
    }

    throw new InvalidTraversalError(`${this.needle} was not a child of ${start}`)
  }
}
