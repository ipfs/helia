import type { FileSystem, CatOptions } from '@helia/interface'
import { exporter } from 'ipfs-unixfs-exporter'
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

  cat (cid: CID, options: CatOptions = {}): ReadableStream<Uint8Array> {
    const blockstore = this.components.blockstore

    const byteSource: UnderlyingByteSource = {
      type: 'bytes',
      async start (controller) {
        const result = await exporter(cid, blockstore)

        if (result.type !== 'file') {
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

export function unixfs () {
  return function createUnixfs (components: UnixFSComponents): FileSystem {
    return new UnixFS(components)
  }
}
