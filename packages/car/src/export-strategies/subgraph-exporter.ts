import { breadthFirstWalker, depthFirstWalker } from '@helia/utils'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { GraphWalker } from '@helia/utils'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

export type SubgraphExporterOrder = 'breadth-first' | 'depth-first'

export interface SubgraphExporterInit {
  /**
   * Graph traversal strategy
   *
   * @default 'breadth-first'
   */
  order?: 'breadth-first' | 'depth-first'
}

/**
 * Traverses the DAG breadth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class SubgraphExporter implements ExportStrategy {
  private order: SubgraphExporterOrder

  constructor (init?: SubgraphExporterInit) {
    this.order = init?.order ?? 'breadth-first'
  }

  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    let walker: GraphWalker

    if (this.order === 'depth-first') {
      walker = depthFirstWalker({
        blockstore,
        getCodec
      })
    } else {
      walker = breadthFirstWalker({
        blockstore,
        getCodec
      })
    }

    for await (const node of walker.walk(cid, options)) {
      yield node.block
    }
  }
}
