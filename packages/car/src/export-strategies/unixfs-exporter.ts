import { depthFirstWalker } from '@helia/utils'
import { DAG_PB_CODEC_CODE, RAW_PB_CODEC_CODE } from '../constants.ts'
import { NotUnixFSError } from '../errors.ts'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

/**
 * Traverses the DAG depth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class UnixFSExporter implements ExportStrategy {
  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    if (cid.code !== DAG_PB_CODEC_CODE && cid.code !== RAW_PB_CODEC_CODE) {
      throw new NotUnixFSError('Target CID was not UnixFS - use the SubGraphExporter to export arbitrary graphs')
    }

    const walker = depthFirstWalker({
      blockstore,
      getCodec
    })

    for await (const node of walker.walk(cid, options)) {
      yield node.block
    }
  }
}
