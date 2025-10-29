import { depthFirstWalker } from '@helia/utils'
import { setMaxListeners, InvalidParametersError } from '@libp2p/interface'
import { anySignal } from 'any-signal'
import { UnixFS } from 'ipfs-unixfs'
import { DAG_PB_CODEC_CODE, RAW_PB_CODEC_CODE } from '../constants.ts'
import { NotUnixFSError } from '../errors.ts'
import type { ExportStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { PBNode } from '@ipld/dag-pb'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID, Version } from 'multiformats/cid'

export interface UnixFSExporterOptions {
  /**
   * Include blocks that start with this offset.
   *
   * If the CID being exported is a directory, this option is ignored.
   *
   * @default 0
   */
  offset?: number

  /**
   * Only include blocks that would include this many file bytes (exclusive,
   * inclusive of offset).
   *
   * If the CID being exported is a directory, this option is ignored.
   *
   * @default Infinity
   */
  length?: number

  /**
   * By default an exported CAR file will include all blocks that make up a
   * directory, and the files that are stored there.
   *
   * To only include blocks that allow the initial enumeration of the directory,
   * pass `true` here
   *
   * @default false
   */
  listingOnly?: boolean
}

function isRawBlock (block: BlockView<any, number, number, Version>): block is BlockView<Uint8Array, 0x55, number, 1> {
  return block.cid.code === RAW_PB_CODEC_CODE
}

function isDagPBBlock (block: BlockView<any, number, number, Version>): block is BlockView<PBNode, 0x70, number, 1> {
  return block.cid.code === DAG_PB_CODEC_CODE
}

function isFile (block: BlockView<any, number, number, 0 | 1>): boolean {
  if (isRawBlock(block)) {
    return true
  } else if (isDagPBBlock(block) && block.value.Data != null) {
    const u = UnixFS.unmarshal(block.value.Data)

    return u.type === 'file' || u.type === 'raw'
  } else {
    throw new NotUnixFSError('Encountered non raw/dag-pb CID in UnixFS DAG')
  }
}

/**
 * Traverses the DAG depth-first starting at the target CID and yields all
 * encountered blocks.
 *
 * Blocks linked to from the target block are traversed using codecs defined in
 * the helia config.
 */
export class UnixFSExporter implements ExportStrategy {
  private options?: UnixFSExporterOptions

  constructor (options?: UnixFSExporterOptions) {
    this.options = options
  }

  async * export (cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    if (cid.code !== DAG_PB_CODEC_CODE && cid.code !== RAW_PB_CODEC_CODE) {
      throw new NotUnixFSError('Target CID was not UnixFS - use the SubGraphExporter to export arbitrary graphs')
    }

    const walker = depthFirstWalker({
      blockstore,
      getCodec
    })

    const offset = this.options?.offset ?? 0
    const length = this.options?.length ?? Infinity
    const listingOnly = this.options?.listingOnly ?? false

    if (offset < 0) {
      throw new InvalidParametersError('Offset cannot be negative')
    }

    if (length < 0) {
      throw new InvalidParametersError('Length cannot be negative')
    }

    let exportingFile: boolean
    const abortController = new AbortController()
    const signal = anySignal([
      abortController.signal,
      options?.signal
    ])
    setMaxListeners(Infinity, abortController.signal, signal)

    function includeChild (child: CID, parent: BlockView<PBNode>): boolean {
      if (exportingFile == null) {
        exportingFile = isFile(parent)
      }

      // ignore offset/length if not exporting a file
      if (!exportingFile) {
        const link = parent.value.Links.find(l => l.Hash.equals(child))
        const u = UnixFS.unmarshal(parent.value.Data ?? new Uint8Array())

        if (u.type === 'directory') {
          // do not include directory files
          return !listingOnly
        }

        if (u.type === 'hamt-sharded-directory' && listingOnly) {
          // only include sub-shards, not directory files
          return link?.Name?.length === 2
        }

        return true
      }

      const childIndex = parent.value.Links.findIndex(link => link.Hash.equals(child))
      const layout = UnixFS.unmarshal(parent.value.Data ?? new Uint8Array())

      const start = offset
      const end = start + length

      const childStart = Number([...layout.blockSizes].slice(0, childIndex).reduce((curr, acc) => curr + acc, 0n))
      const childEnd = childStart + Number(layout.blockSizes[childIndex])

      // slice starts in child
      if (start >= childStart && start < childEnd) {
        return true
      }

      // slice ends in child
      if (end >= childStart && end < childEnd) {
        return true
      }

      // slice contains child
      if (start <= childStart && end >= childEnd) {
        return true
      }

      return false
    }

    try {
      for await (const node of walker.walk(cid, {
        ...options,
        includeChild,
        signal
      })) {
        yield node.block
      }
    } finally {
      abortController.abort()
      signal.clear()
    }
  }
}
