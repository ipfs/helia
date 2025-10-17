import { breadthFirstWalker } from '@helia/utils'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

/**
 * Traverses the DAG breadth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class SubgraphExporter implements ExportStrategy {
  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    const walker = breadthFirstWalker({
      blockstore,
      getCodec
    })

    for await (const node of walker.walk(cid, options)) {
      yield node.block
    }
  }
}
