/**
 * @packageDocumentation
 *
 * `@helia/car` provides `import` and `export` methods to read/write Car files to {@link https://github.com/ipfs/helia Helia}'s blockstore.
 *
 * See the {@link Car} interface for all available operations.
 *
 * By default it supports `dag-pb`, `dag-cbor`, `dag-json` and `raw` CIDs, more esoteric DAG walkers can be passed as an init option.
 *
 * @example Exporting a DAG as a CAR file
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { car } from '@helia/car'
 * import { CarWriter } from '@ipld/car'
 * import { Readable } from 'node:stream'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia({
 *   // ... helia config
 * })
 * const fs = unixfs(helia)
 *
 * // add some UnixFS data
 * const cid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
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
 * @example Importing all blocks from a CAR file
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { unixfs } from '@helia/unixfs'
 * import { car } from '@helia/car'
 * import { CarReader } from '@ipld/car'
 * import { Readable } from 'node:stream'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia({
 *   // ... helia config
 * })
 *
 * // import the car
 * const inStream = nodeFs.createReadStream('example.car')
 * const reader = await CarReader.fromIterable(inStream)
 *
 * const c = car(helia)
 * await c.import(reader)
 * ```
 */

import { CarWriter } from '@ipld/car'
import drain from 'it-drain'
import map from 'it-map'
import { createUnsafe } from 'multiformats/block'
import defer from 'p-defer'
import PQueue from 'p-queue'
import type { CodecLoader } from '@helia/interface'
import type { GetBlockProgressEvents, PutManyBlocksProgressEvents } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface CarComponents {
  blockstore: Blockstore
  getCodec: CodecLoader
}

export interface ExportCarOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {
  /**
   * If a filter is passed it will be used to deduplicate blocks exported in the car file
   */
  blockFilter?: Filter

  /**
   * Root CID of the DAG being operated on. If the CAR root provided to `export` or `stream` is not the root of the dag,
   * we will use this CID as the root of the dag to walk.
   *
   * This allows us to include blocks for path parents, but those are "extra", do not belong to the DAG of exported
   * file, but act as a proof that file DAG belongs to some other parent DAG. This proof can be disregarded if the user
   * only cares about file, without its provenance.
   */
  dagRoot?: CID
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
   * import { Readable } from 'node:stream'
   * import { car } from '@helia/car'
   * import { CarWriter } from '@ipld/car'
   * import { createHelia } from 'helia'
   * import { CID } from 'multiformats/cid'
   * import { pEvent } from 'p-event'
   *
   * const helia = await createHelia()
   * const cid = CID.parse('QmFoo...')
   *
   * const c = car(helia)
   * const { writer, out } = CarWriter.create(cid)
   * const output = fs.createWriteStream('example.car')
   * const stream = Readable.from(out).pipe(output)
   *
   * await Promise.all([
   *   c.export(cid, writer),
   *   pEvent(stream, 'close')
   * ])
   * ```
   *
   * @deprecated Use `stream` instead. In a future release `stream` will be renamed `export`.
   */
  export(root: CID | CID[], writer: Pick<CarWriter, 'put' | 'close'>, options?: ExportCarOptions): Promise<void>

  /**
   * Returns an AsyncGenerator that yields CAR file bytes.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { car } from '@helia/car
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   * const cid = CID.parse('QmFoo...')
   *
   * const c = car(helia)
   *
   * for (const buf of c.stream(cid)) {
   *   // store or send `buf` somewhere
   * }
   * ```
   */
  stream(root: CID | CID[], options?: ExportCarOptions): AsyncGenerator<Uint8Array, void, undefined>
}

const DAG_WALK_QUEUE_CONCURRENCY = 1

class DefaultCar implements Car {
  private readonly components: CarComponents

  constructor (components: CarComponents, init: any) {
    this.components = components
  }

  async import (reader: Pick<CarReader, 'blocks'>, options?: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents>): Promise<void> {
    await drain(this.components.blockstore.putMany(
      map(reader.blocks(), ({ cid, bytes }) => ({ cid, block: bytes })),
      options
    ))
  }

  async export (root: CID | CID[], writer: Pick<CarWriter, 'put' | 'close'>, options?: ExportCarOptions): Promise<void> {
    const deferred = defer<Error | undefined>()
    const roots = Array.isArray(root) ? root : [root]

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })
    queue.on('idle', () => {
      deferred.resolve()
    })
    queue.on('error', (err) => {
      queue.clear()
      deferred.reject(err)
    })

    // If dagRoot is specified, we need to find the path from dagRoot to the roots
    if (options?.dagRoot != null) {
      void queue.add(async () => {
        const dagRoot = options.dagRoot
        if (dagRoot != null) {
          await this.#findPathAndWalkDag(dagRoot, roots, queue, writer, options)
        }
      })
        .catch(() => {})
    } else {
      // Regular walk from the roots
      for (const root of roots) {
        void queue.add(async () => {
          await this.#walkDag(root, queue, writer, options)
        })
          .catch(() => {})
      }
    }

    // wait for the writer to end
    try {
      await deferred.promise
    } finally {
      await writer.close()
    }
  }

  async * stream (root: CID | CID[], options?: ExportCarOptions): AsyncGenerator<Uint8Array, void, undefined> {
    const { writer, out } = CarWriter.create(root)

    // has to be done async so we write to `writer` and read from `out` at the
    // same time
    this.export(root, writer, options)
      .catch(() => {})

    for await (const buf of out) {
      yield buf
    }
  }

  /**
   * Find a path from dagRoot to the target roots, then walk the DAG
   * to export blocks that are in that path
   */
  async #findPathAndWalkDag (
    dagRoot: CID,
    targetRoots: CID[],
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    options?: ExportCarOptions
  ): Promise<void> {
    // Skip if already processed
    if (options?.blockFilter?.has(dagRoot.multihash.bytes) === true) {
      return
    }

    const codec = await this.components.getCodec(dagRoot.code)
    const bytes = await this.components.blockstore.get(dagRoot, options)

    // Mark as processed
    options?.blockFilter?.add(dagRoot.multihash.bytes)

    // Add the block
    await writer.put({ cid: dagRoot, bytes })

    // Check if we've reached one of our target roots
    const isTargetRoot = targetRoots.some(r => r.equals(dagRoot))

    if (isTargetRoot) {
      // If we've found a target root, walk its entire DAG
      const block = createUnsafe({ bytes, cid: dagRoot, codec })

      // Walk all links in the target root's DAG
      for await (const [, cid] of block.links()) {
        void queue.add(async () => {
          await this.#walkDag(cid, queue, writer, options)
        })
      }
    } else {
      // Still looking for path to target, continue searching
      const block = createUnsafe({ bytes, cid: dagRoot, codec })

      // Continue search through links
      for await (const [, cid] of block.links()) {
        void queue.add(async () => {
          await this.#findPathAndWalkDag(cid, targetRoots, queue, writer, options)
        })
      }
    }
  }

  /**
   * Walk the DAG behind the passed CID, ensure all blocks are present in the blockstore
   * and update the pin count for them
   */
  async #walkDag (
    cid: CID,
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    options?: ExportCarOptions
  ): Promise<void> {
    // Skip this block, before fetching from the network, if it's already been processed
    if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
      return
    }

    const codec = await this.components.getCodec(cid.code)
    const bytes = await this.components.blockstore.get(cid, options)

    // Mark the block as processed
    options?.blockFilter?.add(cid.multihash.bytes)

    await writer.put({ cid, bytes })

    const block = createUnsafe({ bytes, cid, codec })

    // walk dag, ensure all blocks are present
    for await (const [,cid] of block.links()) {
      void queue.add(async () => {
        await this.#walkDag(cid, queue, writer, options)
      })
    }
  }
}

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: CarComponents, init: any = {}): Car {
  return new DefaultCar(helia, init)
}
