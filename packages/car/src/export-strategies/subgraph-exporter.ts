import { breadthFirstWalker } from '@helia/utils'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { GraphWalker, GraphWalkerComponents } from '@helia/utils'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

export interface SubgraphExporterInit {
  /**
   * Graph traversal strategy, defaults to breadth-first
   */
  walker?(components: GraphWalkerComponents): GraphWalker
}

/**
 * Traverses the DAG breadth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class SubgraphExporter implements ExportStrategy {
  private walker?: (components: GraphWalkerComponents) => GraphWalker

  constructor (init?: SubgraphExporterInit) {
    this.walker = init?.walker
  }

  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    let walker: GraphWalker
    const components = {
      blockstore,
      getCodec
    }

    if (this.walker != null) {
      walker = this.walker(components)
    } else {
      walker = breadthFirstWalker()(components)
    }

    for await (const node of walker.walk(cid, options)) {
      yield node.block
    }
  }
}
