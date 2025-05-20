import { DAG_PB_CODEC_CODE, RAW_PB_CODEC_CODE } from '../constants.js'
import { NotUnixFSError } from '../errors.js'
import type { ExportStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'
import type { CID } from 'multiformats/cid'

/**
 * This exporter is used when you want to generate a car file that contains a
 * single UnixFS file or directory
 */
export class UnixFSExporter implements ExportStrategy {
  async * export (cid: CID, block: BlockView<any, any, any, 0 | 1>): AsyncGenerator<CID, void, undefined> {
    if (cid.code !== DAG_PB_CODEC_CODE && cid.code !== RAW_PB_CODEC_CODE) {
      throw new NotUnixFSError('Target CID was not UnixFS - use the SubGraphExporter to export arbitrary graphs')
    }

    // yield all the blocks that make up the file or directory
    for (const [, linkedCid] of block.links()) {
      yield linkedCid
    }
  }
}
