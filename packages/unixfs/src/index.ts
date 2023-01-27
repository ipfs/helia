import type { CatOptions, Helia } from '@helia/interface'
import { exporter } from 'ipfs-unixfs-exporter'
import { ImportCandidate, importer, ImportResult, UserImporterOptions } from 'ipfs-unixfs-importer'
import type { CID } from 'multiformats'
import type { Blockstore } from 'interface-blockstore'
import { NotAFileError, NoContentError } from '@helia/interface/errors'
import type { ReadableStream } from 'node:stream/web'

export interface UnixFSComponents {
  blockstore: Blockstore
}

class UnixFS {
  private readonly components: UnixFSComponents

  constructor (components: UnixFSComponents) {
    this.components = components
  }

  async * add (source: AsyncIterable<ImportCandidate> | Iterable<ImportCandidate> | ImportCandidate, options?: UserImporterOptions): AsyncGenerator<ImportResult> {
    yield * importer(source, this.components.blockstore, options)
  }

  cat (cid: CID, options: CatOptions = {}): ReadableStream<Uint8Array> {
    const blockstore = this.components.blockstore

    const byteSource: UnderlyingByteSource = {
      type: 'bytes',
      async start (controller) {
        const result = await exporter(cid, blockstore)

        if (result.type !== 'file' && result.type !== 'raw') {
          throw new NotAFileError()
        }

        if (result.content == null) {
          throw new NoContentError()
        }

        try {
          for await (const buf of result.content({
            offset: options.offset,
            length: options.length
          })) {
            // TODO: backpressure?
            controller.enqueue(buf)
          }
        } finally {
          controller.close()
        }
      }
    }

    // @ts-expect-error types are broken?
    return new ReadableStream(byteSource)
  }
}

export function unixfs (helia: Helia): UnixFS {
  return new UnixFS(helia)
}
