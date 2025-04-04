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
import { type CID } from 'multiformats/cid'
import defer from 'p-defer'
import PQueue from 'p-queue'
import { DAG_WALK_QUEUE_CONCURRENCY } from './constants.js'
import { SubgraphExporter } from './export-strategies/subgraph-exporter.js'
import { GraphSearch } from './traversal-strategies/graph-search.js'
import type { CodecLoader } from '@helia/interface'
import type { PutManyBlocksProgressEvents, GetBlockProgressEvents } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions, Logger, ComponentLogger } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats/block/interface'
import type { ProgressOptions } from 'progress-events'

export interface CarComponents {
  logger?: ComponentLogger
  blockstore: Blockstore
  getCodec: CodecLoader
}

export interface Strategy {
  /**
   * Traverse the DAG and yield the next CID to traverse
   */
  traverse<T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined>

}

/**
 * Interface for different traversal strategies.
 *
 * While traversing the DAG, it will yield blocks that it has traversed.
 *
 * When done traversing, it should contain the path from the root(s) to the target CID.
 */
export interface TraversalStrategy extends Strategy {
  isTarget(cid: CID): boolean
}

/**
 * Interface for different export strategies.
 * When traversal has ended the export begins starting at the target CID, and the export strategy may do further traversal and writing to the car file.
 */
export interface ExportStrategy extends Strategy {

}

export * from './export-strategies/index.js'
export * from './traversal-strategies/index.js'

export interface ExportCarOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {

  /**
   * If true, the blockstore will not do any network requests.
   *
   * @default false
   */
  offline?: boolean

  /**
   * If a filter is passed it will be used to deduplicate blocks exported in the car file
   */
  blockFilter?: Filter

  /**
   * The traversal strategy to use for the export. This determines how the dag is traversed: either depth first, breadth first, or a custom strategy.
   */
  traversal?: TraversalStrategy

  /**
   * Export strategy to use for the export. This should be used to change the `dag-scope` of the exported car file.
   */
  exporter?: ExportStrategy
}

/**
 * Context for the traversal process.
 */
interface TraversalContext {
  currentPath: CID[]
  pathsToTarget: CID[][] | null // collect all target paths
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

class DefaultCar implements Car {
  private readonly components: CarComponents
  private readonly log?: Logger

  constructor (components: CarComponents, init: any) {
    this.components = components
    this.log = components.logger?.forComponent('helia:car')
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

    // Create traversal-specific context
    const traversalContext: TraversalContext = {
      currentPath: [],
      pathsToTarget: null
    }

    const traversalStrategy = options?.traversal
    const exportStrategy = options?.exporter ?? new SubgraphExporter()

    // use a queue to walk the DAG instead of recursion so we can traverse very large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })

    let startedExport = false
    queue.on('idle', () => {
      if (startedExport) {
        // idle event was called, and started exporting, so we are done.
        deferred.resolve()
      } else if (!startedExport && traversalContext.pathsToTarget?.length === roots.length) {
        // queue is idle, we haven't started exporting yet, and we have path(s) to the target(s), so we can start the export process.
        this.log?.trace('pathToTarget %o', traversalContext.pathsToTarget)
        this.log?.trace('starting export of blocks to the car file')
        startedExport = true
        for (const path of traversalContext.pathsToTarget) {
          const targetIndex = path.length - 1
          const targetCid = path[targetIndex]
          // Process all verification blocks in the path except the target
          path.slice(0, -1).forEach(cid => {
            void queue.add(async () => {
              await this.#processVerificationBlock(cid, writer, options)
            }).catch(() => {})
          })
          // Process the target block (which will recursively export its DAG)
          void queue.add(async () => {
            await this.#processBlock(targetCid, queue, writer, exportStrategy, options)
          }).catch(() => {})
        }
      }
    })
    queue.on('error', (err) => {
      queue.clear()
      deferred.reject(err)
    })

    for (const root of roots) {
      void queue.add(async () => {
        this.log?.trace('traversing dag from %c', root)
        await this.#traverseDag(root, queue, writer, traversalStrategy ?? new GraphSearch(root), traversalContext, [], options)
      })
        .catch(() => {})
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

  async #traverseDag (
    cid: CID,
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    strategy: TraversalStrategy,
    traversalContext: TraversalContext,
    parentPath: CID[] = [], // Track the path
    options: ExportCarOptions | undefined
  ): Promise<void> {
    // Build the current path based on the parent path plus the current CID
    const currentPath = [...parentPath, cid]
    this.log?.trace('currentPath %o', currentPath)

    if (strategy.isTarget(cid)) {
      traversalContext.pathsToTarget = traversalContext.pathsToTarget ?? []
      traversalContext.pathsToTarget.push([...currentPath])
      this.log?.trace('found path to target %c', cid)
      return
    }

    const codec = await this.components.getCodec(cid.code)
    const bytes = await this.components.blockstore.get(cid, options)
    const decodedBlock = createUnsafe({ bytes, cid, codec })

    for await (const nextCid of strategy.traverse(cid, decodedBlock)) {
      void queue.add(async () => {
        await this.#traverseDag(nextCid, queue, writer, strategy, traversalContext, currentPath, options)
      })
    }
  }

  async #processVerificationBlock (
    cid: CID,
    writer: Pick<CarWriter, 'put'>,
    options: ExportCarOptions | undefined
  ): Promise<void> {
    // Skip if already processed
    if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
      return
    }
    this.log?.trace('processing verification block %c', cid)
    const bytes = await this.components.blockstore.get(cid, options)
    // Mark as processed
    options?.blockFilter?.add(cid.multihash.bytes)

    // Write to CAR
    await writer.put({ cid, bytes })

    this.log?.trace('processed verification block %c', cid)
  }

  /**
   * Common method for processing a block with a specific traversal strategy
   */
  async #processBlock (
    cid: CID,
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    strategy: Strategy,
    options: ExportCarOptions | undefined
  ): Promise<void> {
    // try {
    // Skip if already processed
    if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
      return
    }
    this.log?.trace('processing block %c', cid)

    const codec = await this.components.getCodec(cid.code)
    const bytes = await this.components.blockstore.get(cid, options)

    // Mark as processed
    options?.blockFilter?.add(cid.multihash.bytes)

    // Write to CAR
    await writer.put({ cid, bytes })
    this.log?.trace('processed  block %c', cid)

    const decodedBlock = createUnsafe({ bytes, cid, codec })

    // Process links according to the strategy
    for await (const nextCid of strategy.traverse(cid, decodedBlock)) {
      this.log?.trace('next cid %c', nextCid)
      void queue.add(async () => {
        await this.#processBlock(nextCid, queue, writer, strategy, options)
      })
    }
    // } catch (err: any) {
    //   if (err.name === 'NotFoundError') {
    //     this.log?.error('block %c not found in blockstore', cid)
    //     throw err
    //   }

    //   // Handle errors, but don't propagate them to avoid breaking the queue
    //   this.log?.error('error processing block - %e', err)
    // }
  }
}

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: CarComponents, init: any = {}): Car {
  return new DefaultCar(helia, init)
}
