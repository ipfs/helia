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
import { defaultLogger, logger } from '@libp2p/logger'
import drain from 'it-drain'
import map from 'it-map'
import { createUnsafe } from 'multiformats/block'
import defer from 'p-defer'
import PQueue from 'p-queue'
import { DAG_WALK_QUEUE_CONCURRENCY } from './constants.js'
import { DagScope } from './dag-scope.js'
import { PathFindingStrategy } from './strategies/path-finding-strategy.js'
import { StandardWalkStrategy } from './strategies/standard-walk-strategy.js'
import type { ExportCarOptions, TraversalStrategy, CarComponents } from './types.js'
import type { PutManyBlocksProgressEvents } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export { DagScope, type ExportCarOptions, type CarComponents }

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

class DefaultCar implements Car {
  private readonly components: CarComponents
  private readonly log: Logger

  constructor (components: CarComponents, init: any) {
    this.components = components
    this.log = (init.logger ?? defaultLogger()).forComponent('helia:car')
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

    // Validate knownDagPath if provided
    if (options?.knownDagPath != null && options.knownDagPath.length > 0) {
      const knownPath = options.knownDagPath

      // ensure dagRoot is provided and matches the first CID in the path
      if (options?.dagRoot == null) {
        options.dagRoot = knownPath[0]
      } else if (!options.dagRoot.equals(knownPath[0])) {
        throw new Error('knownDagPath must start with dagRoot')
      }

      // Ensure the last CID in the path is one of the target roots
      const lastCid = knownPath[knownPath.length - 1]
      const isTargetRoot = roots.some(r => r.equals(lastCid))
      if (!isTargetRoot) {
        throw new Error('knownDagPath must end with one of the target roots')
      }

      // knownDagPath is valid, we should double-check that the blockstore has all the blocks
      const blockstore = this.components.blockstore
      for (let i = 0; i < knownPath.length; i++) {
        const cid = knownPath[i]
        if (!(await blockstore.has(cid))) {
          throw new Error(`CID in knownDagPath at index ${i} not found in blockstore`)
        }
      }
    }

    // If dagRoot is specified and knownDagPath is provided, use the known path
    if (options?.dagRoot != null && options?.knownDagPath != null && options.knownDagPath.length > 0) {
      const knownPath = options.knownDagPath
      void queue.add(async () => {
        await this.#processKnownPathStrategy(knownPath, queue, writer, options)
      })
        .catch(() => {})
    } else if (options?.dagRoot != null) {
      void queue.add(async () => {
        const dagRoot = options.dagRoot
        if (dagRoot != null) {
          // Use path finding strategy to navigate from dagRoot to target roots
          await this.#processBlock(
            dagRoot,
            queue,
            writer,
            new PathFindingStrategy(roots),
            options
          )
        }
      })
        .catch(() => {})
    } else {
      // Regular walk from the roots
      for (const root of roots) {
        void queue.add(async () => {
          // Use standard walk strategy for traversing from roots
          await this.#processBlock(
            root,
            queue,
            writer,
            new StandardWalkStrategy(),
            options
          )
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
   * Common method for processing a block with a specific traversal strategy
   */
  async #processBlock (
    cid: CID,
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    strategy: TraversalStrategy,
    options: ExportCarOptions | undefined
  ): Promise<void> {
    try {
      // Skip if already processed
      if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
        return
      }

      const codec = await this.components.getCodec(cid.code)
      const bytes = await this.components.blockstore.get(cid, options)

      // Mark as processed
      options?.blockFilter?.add(cid.multihash.bytes)

      // Write to CAR
      await writer.put({ cid, bytes })

      const decodedBlock = createUnsafe({ bytes, cid, codec })

      // Determine if we should traverse using the provided strategy
      if (strategy.shouldTraverse(cid, options)) {
        // Process links according to the strategy
        for await (const result of strategy.getNextCidStrategy(cid, decodedBlock)) {
          if (typeof result === 'object' && 'cid' in result) {
            // If strategy returns a new CID with a strategy
            void queue.add(async () => {
              await this.#processBlock(result.cid, queue, writer, result.strategy, options)
            })
          } else {
            // If strategy just returns a CID
            void queue.add(async () => {
              await this.#processBlock(result, queue, writer, strategy, options)
            })
          }
        }
      }
    } catch (err) {
      // Handle errors, but don't propagate them to avoid breaking the queue
      this.log.error('Error processing block', err)
    }
  }

  /**
   * Special method for processing known paths, which has different error handling
   */
  async #processKnownPathStrategy (
    cids: CID[],
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    options: ExportCarOptions | undefined
  ): Promise<void> {
    if (cids.length === 0) {
      return
    }

    // process each CID in the path
    for (let i = 0; i < cids.length; i++) {
      const cid = cids[i]
      const isLastCID = i === cids.length - 1

      try {
        // Skip this block if it's already been processed
        if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
          continue
        }

        const codec = await this.components.getCodec(cid.code)
        const bytes = await this.components.blockstore.get(cid, options)

        // Mark as processed
        options?.blockFilter?.add(cid.multihash.bytes)

        // Write to CAR
        await writer.put({ cid, bytes })

        const decodedBlock = createUnsafe({ bytes, cid, codec })

        // Only the last CID (the target) needs traversal with dagScope rules
        if (isLastCID) {
          const strategy = new StandardWalkStrategy()
          if (!strategy.shouldTraverse(cid, options)) {
            return
          }

          for await (const linkedCid of strategy.getNextCidStrategy(cid, decodedBlock)) {
            void queue.add(async () => {
              await this.#processBlock(linkedCid, queue, writer, strategy, options)
            })
          }
        }
      } catch (err) {
        this.log.error('Error processing block in knownDagPath', err)
      }
    }
  }
}

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: CarComponents, init: any = {}): Car {
  return new DefaultCar(helia, init)
}
