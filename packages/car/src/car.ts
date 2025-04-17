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
import type { CarComponents, Car as CarInterface, ExportCarOptions, ExportStrategy, TraversalStrategy } from './index.js'
import type { PutManyBlocksProgressEvents } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

/**
 * Context for the traversal process.
 */
interface TraversalContext {
  currentPath: CID[]
  pathsToTarget: CID[][] | null // collect all target paths
}

interface WalkDagContext<Strategy> {
  cid: CID
  queue: PQueue
  strategy: Strategy
  writer?: Pick<CarWriter, 'put'>
  options?: ExportCarOptions
  traversalContext?: TraversalContext
  parentPath?: CID[]
  recursive?: boolean
}

export class Car implements CarInterface {
  private readonly components: CarComponents
  private readonly log: Logger

  constructor (components: CarComponents, init: any) {
    this.components = components
    this.log = components.logger.forComponent('helia:car')
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

    // use a queue to walk the DAG instead of recursion so we can traverse very
    // large DAGs
    const queue = new PQueue({
      concurrency: DAG_WALK_QUEUE_CONCURRENCY
    })

    let startedExport = false
    queue.on('idle', () => {
      if (startedExport) {
        // idle event was called, and started exporting, so we are done.
        deferred.resolve()
      } else if (!startedExport && traversalContext.pathsToTarget?.length === roots.length) {
        // queue is idle, we haven't started exporting yet, and we have path(s)
        // to the target(s), so we can start the export process.
        this.log.trace('starting export of blocks to the car file')
        startedExport = true

        for (const path of traversalContext.pathsToTarget) {
          const targetIndex = path.length - 1
          const targetCid = path[targetIndex]

          // Process all verification blocks in the path except the target
          path.slice(0, -1).forEach(cid => {
            void queue.add(async () => {
              await this.#exportDagNode({ cid, queue, writer, strategy: exportStrategy, options, recursive: false })
            })
              .catch((err) => {
                this.log.error('error during queue operation - %e', err)
              })
          })

          // Process the target block (which will recursively export its DAG)
          void queue.add(async () => {
            await this.#exportDagNode({ cid: targetCid, queue, writer, strategy: exportStrategy, options })
          })
            .catch((err) => {
              this.log.error('error during queue operation - %e', err)
            })
        }
      } else {
        // queue is idle, we haven't started exporting yet, and we don't have
        // path(s) to the target(s), so we can't start the export process.
        // this should not happen without a separate error during traversal, but
        // we'll handle it here anyway.
        this.log.trace('no paths to target, skipping export')
        deferred.reject(new Error('Could not traverse to target CID(s)'))
      }
    })
    queue.on('error', (err) => {
      queue.clear()
      deferred.reject(err)
    })

    for (const root of roots) {
      void queue.add(async () => {
        this.log.trace('traversing dag from %c', root)
        await this.#traverseDagNode({ cid: root, queue, strategy: traversalStrategy ?? new GraphSearch(root), traversalContext, parentPath: [], options })
      })
        .catch((err) => {
          this.log.error('error during queue operation - %e', err)
        })
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
      .catch((err) => {
        this.log.error('error during streaming export - %e', err)
      })

    for await (const buf of out) {
      yield buf
    }
  }

  /**
   * Traverse a DAG and stop when we reach the target node
   */
  async #traverseDagNode ({ cid, queue, writer, strategy, traversalContext, parentPath, options, recursive = true }: WalkDagContext<TraversalStrategy>): Promise<void> {
    if (writer != null && options?.blockFilter?.has(cid.multihash.bytes) === true) {
      return
    }

    let currentPath: CID[]

    // if we are traversing, we need to gather path(s) to the target(s)
    if (traversalContext != null && parentPath != null) {
      currentPath = [...parentPath, cid]

      if (strategy.isTarget(cid)) {
        traversalContext.pathsToTarget = traversalContext.pathsToTarget ?? []
        traversalContext.pathsToTarget.push([...currentPath])
        this.log.trace('found path to target %c', cid)
        return
      }
    }

    const codec = await this.components.getCodec(cid.code)
    const bytes = await this.components.blockstore.get(cid, options)

    if (writer != null) {
      // writer is not null, so we are writing to a car file
      // Mark as processed
      options?.blockFilter?.add(cid.multihash.bytes)

      // Write to CAR
      await writer.put({ cid, bytes })
    }

    if (recursive) {
      // we are recursively traversing the dag
      const decodedBlock = createUnsafe({ bytes, cid, codec })

      for await (const nextCid of strategy.traverse(cid, decodedBlock)) {
        void queue.add(async () => {
          await this.#traverseDagNode({ cid: nextCid, queue, writer, strategy, traversalContext, parentPath: currentPath ?? [], options })
        })
          .catch((err) => {
            this.log.error('error during traversal queue operation - %e', err)
          })
      }
    }
  }

  /**
   * Use an ExportStrategy to export part of all of a DAG
   */
  async #exportDagNode ({ cid, queue, writer, strategy, traversalContext, options, recursive = true }: WalkDagContext<ExportStrategy>): Promise<void> {
    if (writer != null && options?.blockFilter?.has(cid.multihash.bytes) === true) {
      return
    }

    const codec = await this.components.getCodec(cid.code)
    const bytes = await this.components.blockstore.get(cid, options)

    if (writer != null) {
      // writer is not null, so we are writing to a car file
      // Mark as processed
      options?.blockFilter?.add(cid.multihash.bytes)

      // Write to CAR
      await writer.put({ cid, bytes })
    }

    if (recursive) {
      // we are recursively traversing the dag
      const decodedBlock = createUnsafe({ bytes, cid, codec })

      for await (const nextCid of strategy.export(cid, decodedBlock)) {
        void queue.add(async () => {
          await this.#exportDagNode({ cid: nextCid, queue, writer, strategy, traversalContext, parentPath: [], options })
        })
          .catch((err) => {
            this.log.error('error during export queue operation - %e', err)
          })
      }
    }
  }
}
