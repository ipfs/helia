import toBuffer from 'it-to-buffer'
import { createUnsafe } from 'multiformats/block'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

/**
 * Yields the first block from the first CID and stops
 */
export class BlockExporter implements ExportStrategy {
  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    const bytes = await toBuffer(blockstore.get(cid, options))
    yield createUnsafe({
      cid,
      bytes,
      codec: await getCodec(cid.code)
    })
  }
}
