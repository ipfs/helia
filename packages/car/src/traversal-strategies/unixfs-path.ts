import { decode } from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs'
import { DAG_PB_CODEC_CODE } from '../constants.js'
import { NotUnixFSError } from '../errors.js'
import type { TraversalStrategy } from '../index.js'
import type { BlockView } from 'multiformats/block/interface'
import type { CID } from 'multiformats/cid'

/**
 * Traverses a DAG containing UnixFS directories
 */
export class UnixFSPath implements TraversalStrategy {
  private readonly path: string[]

  constructor (path: string) {
    // "/foo/bar/baz.txt" -> ['foo', 'bar', 'baz.txt']
    this.path = path.replace(/^\//, '').split('/')
  }

  isTarget (): boolean {
    return this.path.length === 0
  }

  async * traverse <T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined> {
    if (cid.code !== DAG_PB_CODEC_CODE) {
      throw new NotUnixFSError('Target CID was not UnixFS')
    }

    const segment = this.path.shift()

    if (segment == null) {
      return
    }

    const pb = decode(block.bytes)

    if (pb.Data == null) {
      throw new NotUnixFSError('Target CID was not a UnixFS directory')
    }

    const unixfs = UnixFS.unmarshal(pb.Data)

    if (unixfs.type === 'directory') {
      const link = pb.Links.filter(link => link.Name === segment).pop()

      if (link == null) {
        throw new NotUnixFSError('Target CID was not a UnixFS directory')
      }

      yield link.Hash
      return
    }

    // TODO: HAMT support

    throw new NotUnixFSError('Target CID was not a UnixFS directory')
  }
}
