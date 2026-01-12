import * as dagPb from '@ipld/dag-pb'
import { exporter, walkPath } from 'ipfs-unixfs-exporter'
import { createUnsafe } from 'multiformats/block'
import type { TraversalStrategy } from '../index.js'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats'
import type { CID } from 'multiformats/cid'

/**
 * Traverses a DAG containing UnixFS directories
 *
 * A root CID may be specified to begin traversal from, otherwise the root
 * currently being exported will be used.
 *
 * @example Begin traversal from the root being exported
 *
 * In this example, the UnixFS path `/foo/bar/baz.txt` path should be resolvable
 * beneath the `root` CID.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car, UnixFSPath } from '@helia/car'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 * const c = car(helia)
 * const root = CID.parse('QmRoot')
 *
 * for await (const buf of c.export(root, {
 *   traversal: new UnixFSPath('/foo/bar/baz.txt')
 * })) {
 *   // do something with `buf`
 * }
 * ```
 *
 * @example Begin traversal from a parent node
 *
 * In this example, the `root` CID should be resolvable at the UnixFS path
 * beneath `parentCID`.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car, UnixFSPath } from '@helia/car'
 * import { CID } from 'multiformats/cid'
 *
 * const helia = await createHelia()
 * const c = car(helia)
 * const root = CID.parse('QmRoot')
 * const parentCID = CID.parse('QmParent')
 *
 * for await (const buf of c.export(root, {
 *   traversal: new UnixFSPath(parentCID, '/foo/bar/baz.txt')
 * })) {
 *   // do something with `buf`
 * }
 * ```
 */
export class UnixFSPath implements TraversalStrategy {
  private readonly root?: CID
  private readonly path: string

  constructor (path: string)
  constructor (root: CID, path: string)
  constructor (...args: any[]) {
    let root: CID | string | undefined = args[0]
    let path: string = args[1]

    if (typeof root === 'string') {
      path = root
      root = undefined
    } else if (args.length < 2) {
      throw new Error('path or CID and path must be specified')
    }

    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    this.root = root
    this.path = path
  }

  async * traverse (root: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined> {
    for await (const entry of walkPath(`${this.root ?? root}${this.path}`, blockstore, options)) {
      const file = await exporter(entry.cid, blockstore, options)

      yield createUnsafe({
        cid: file.cid,
        bytes: file.node instanceof Uint8Array ? file.node : dagPb.encode(file.node),
        codec: await getCodec(entry.cid.code)
      })
    }
  }
}
