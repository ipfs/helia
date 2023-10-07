/**
 * @packageDocumentation
 *
 * `@helia/car` provides `import` and `export` methods to read/write Car files to {@link https://github.com/ipfs/helia Helia}'s blockstore.
 *
 * See the {@link Car} interface for all available operations.
 *
 * By default it supports `dag-pb`, `dag-cbor`, `dag-json` and `raw` CIDs, more esoteric DAG walkers can be passed as an init option.
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { car } from '@helia/car'
 * import { CarWriter } from '@ipld/car'
 * import { Readable } from 'node:stream'
 * import nodeFs from 'node:fs'
 *
 * const helia = createHelia({
 *   // ... helia config
 * })
 * const fs = unixfs(helia)
 *
 * // add some UnixFS data
 * const cid = await fs.addBytes(fileData1)
 *
 * // export it as a Car
 * const c = car(helia)
 * const { writer, out } = await CarWriter.create(cid)
 *
 * // `out` needs to be directed somewhere, see the @ipld/car docs for more information
 * Readable.from(out).pipe(nodeFs.createWriteStream('example.car'))
 *
 * // write the DAG behind `cid` into the writer
 * await c.export(cid, writer)
 * ```
 *
 * @example
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { car } from '@helia/car'
 * import { CarReader } from '@ipld/car'
 * import { Readable } from 'node:stream'
 * import nodeFs from 'node:fs'
 *
 * const helia = createHelia({
 *   // ... helia config
 * })
 *
 * // import the car
 * const inStream = nodeFs.createReadStream('example.car')
 * const reader = await CarReader.fromIterable(inStream)
 *
 * await c.import(reader)
 * ```
 */

import drain from 'it-drain'
import map from 'it-map'
import defer from 'p-defer'
import PQueue from 'p-queue'
import { cborWalker, dagPbWalker, jsonWalker, rawWalker } from './utils/dag-walkers.js'
import type { Blocks, GetBlockProgressEvents, PutManyBlocksProgressEvents } from '@helia/interface/blocks'
import type { CarReader, CarWriter } from '@ipld/car'
import type { AbortOptions } from '@libp2p/interfaces'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface CarComponents {
  blockstore: Blocks
}

export interface CarInit {
  /**
   * In order to export CIDs that correspond to a DAG, it's necessary to know
   * how to traverse that DAG.  DAGWalkers take a block and yield any CIDs
   * encoded within that block.
   */
  dagWalkers?: DAGWalker[]
}

/**
 * DAGWalkers take a block and yield CIDs encoded in that block
 */
export interface DAGWalker {
  codec: number
  walk(block: Uint8Array): AsyncGenerator<CID, void, undefined>
}

/**
 * The Car interface provides operations for importing and exporting Car files
 * from Helia's underlying blockstore.
 */
export interface Car {
  /**
   * Add all blocks in the passed CarReader to the blockstore.
   *
   * @example
   *
   * ```typescript
   * import fs from 'node:fs'
   * import { createHelia } from 'helia'
   * import { car } from '@helia/car
   * import { CarReader } from '@ipld/car'
   *
   * const helia = await createHelia()
   *
   * const inStream = fs.createReadStream('example.car')
   * const reader = await CarReader.fromIterable(inStream)
   *
   * const c = car(helia)
   * await c.import(reader)
   * ```
   */
  import(reader: Pick<CarReader, 'blocks'>, options?: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents>): Promise<void>

  /**
   * Store all blocks that make up one or more DAGs in a car file.
   *
   * @example
   *
   * ```typescript
   * import fs from 'node:fs'
   * import { Readable } from 'stream'
   * import { createHelia } from 'helia'
   * import { car } from '@helia/car
   * import { CID } from 'multiformats/cid'
   * import pEvent from 'p-event'
   *
   * const helia = await createHelia()
   * const cid = CID.parse('QmFoo...')
   *
   * const c = car(helia)
   *
   * const byteStream = await c.export(cid)
   * const output = fs.createWriteStream('example.car')
   * const eventPromise = pEvent(output, 'end')
   * Readable.from(byteStream).pipe(output)
   *
   * await eventPromise
   * ```
   */
  export(root: CID | CID[], writer: Pick<CarWriter, 'put' | 'close'>, options?: AbortOptions & ProgressOptions<GetBlockProgressEvents>): Promise<void>
}

const DEFAULT_DAG_WALKERS = [
  rawWalker,
  dagPbWalker,
  cborWalker,
  jsonWalker
]

const DAG_WALK_QUEUE_CONCURRENCY = 1

class DefaultCar implements Car {
  private readonly components: CarComponents
  private dagWalkers: Record<number, DAGWalker>

  constructor (components: CarComponents, init: CarInit) {
    this.components = components

    this.dagWalkers = {}

    ;[...DEFAULT_DAG_WALKERS, ...(init.dagWalkers ?? [])].forEach(dagWalker => {
      this.dagWalkers[dagWalker.codec] = dagWalker
    })
  }

  async import (reader: Pick<CarReader, 'blocks'>, options?: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents>): Promise<void> {
    await drain(this.components.blockstore.putMany(
      map(reader.blocks(), ({ cid, bytes }) => ({ cid, block: bytes })),
      options
    ))
  }

  async export (root: CID | CID[], writer: Pick<CarWriter, 'put' | 'close'>, options?: AbortOptions & ProgressOptions<GetBlockProgressEvents>): Promise<void> {
    const deferred = defer()
    const roots = Array.isArray(root) ? root : [root]

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })
    queue.on('idle', () => {
      deferred.resolve()
    })
    queue.on('error', (err) => {
      deferred.resolve(err)
    })

    for (const root of roots) {
      void queue.add(async () => {
        await this.#walkDag(root, queue, async (cid, bytes) => {
          await writer.put({ cid, bytes })
        }, options)
      })
    }

    // wait for the writer to end
    try {
      await deferred.promise
    } finally {
      await writer.close()
    }
  }

  /**
   * Walk the DAG behind the passed CID, ensure all blocks are present in the blockstore
   * and update the pin count for them
   */
  async #walkDag (cid: CID, queue: PQueue, withBlock: (cid: CID, block: Uint8Array) => Promise<void>, options?: AbortOptions & ProgressOptions<GetBlockProgressEvents>): Promise<void> {
    const dagWalker = this.dagWalkers[cid.code]

    if (dagWalker == null) {
      throw new Error(`No dag walker found for cid codec ${cid.code}`)
    }

    const block = await this.components.blockstore.get(cid, options)

    await withBlock(cid, block)

    // walk dag, ensure all blocks are present
    for await (const cid of dagWalker.walk(block)) {
      void queue.add(async () => {
        await this.#walkDag(cid, queue, withBlock, options)
      })
    }
  }
}

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: { blockstore: Blocks }, init: CarInit = {}): Car {
  return new DefaultCar(helia, init)
}
