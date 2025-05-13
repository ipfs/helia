import { Queue } from '@libp2p/utils/queue'
import { createUnsafe } from 'multiformats/block'
import type { CodecLoader } from '@helia/interface'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

const DAG_WALK_QUEUE_CONCURRENCY = 1

export interface DagWalkOptions extends AbortOptions {
  /**
   * How many sub-graphs to walk at once. If greater than `1`, traversal order
   * will be non-deterministic.
   *
   * @default {1}
   */
  concurrency?: number

  /**
   * Pass a value here to limit the maximum depth that will be descended to.
   *
   * @default {Infinity}
   */
  depth?: number

  /**
   * If `true`, and a block is missing from the blockstore, a `NotFoundError`
   * will be thrown instead of attempting to fetch it from the routing.
   *
   * @default {false}
   */
  offline?: boolean
}

export async function * dagWalker (cid: CID, getCodec: CodecLoader, blockstore: Blockstore, options: DagWalkOptions = {}): AsyncGenerator<CID> {
  options.depth = Math.round(options.depth ?? Infinity)

  if (options.depth < 0) {
    throw new Error('Depth must be greater than or equal to 0')
  }

  // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
  const queue = new Queue<AsyncGenerator<CID>>({
    concurrency: options.concurrency ?? DAG_WALK_QUEUE_CONCURRENCY
  })

  yield * walkDag(cid, queue, getCodec, blockstore, options)
}

/**
 * Walk a DAG in an iterable fashion
 */
async function * walkDag (cid: CID, queue: Queue<AsyncGenerator<CID>>, getCodec: CodecLoader, blockstore: Blockstore, options: DagWalkOptions): AsyncGenerator<CID> {
  if (options.depth === -1) {
    return
  }

  const codec = await getCodec(cid.code)
  const bytes = await blockstore.get(cid, options)
  const block = createUnsafe({ bytes, cid, codec })

  yield cid

  // walk dag, ensure all blocks are present
  for await (const [,cid] of block.links()) {
    yield * await queue.add(async () => {
      return walkDag(cid, queue, getCodec, blockstore, {
        ...options,
        depth: (options?.depth ?? 0) - 1
      })
    })
  }
}
