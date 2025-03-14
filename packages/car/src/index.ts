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

/**
 * DAG scope for CAR exports as specified in the trustless gateway spec
 */
export enum DagScope {
  /**
   * Only the root block at the end of the path is returned after blocks required
   * to verify the specified path segments.
   */
  BLOCK = 'block',

  /**
   * For queries that traverse UnixFS data, 'entity' roughly means return blocks
   * needed to verify the terminating element of the requested content path.
   * For UnixFS, all the blocks needed to read an entire UnixFS file, or enumerate
   * a UnixFS directory. For all queries that reference non-UnixFS data, 'entity'
   * is equivalent to 'block'
   */
  ENTITY = 'entity',

  /**
   * Transmit the entire contiguous DAG that begins at the end of the path
   * query, after blocks required to verify path segments
   *
   * This is the default behavior.
   */
  ALL = 'all'
}

export interface ExportCarOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents> {
  /**
   * If a filter is passed it will be used to deduplicate blocks exported in the car file
   */
  blockFilter?: Filter

  /**
   * The DAG scope to use for the export.
   *
   * @default DagScope.ALL
   */
  dagScope?: DagScope

  /**
   * Root CID of the DAG being operated on. If the CAR root provided to `export` or `stream` is not the root of the dag,
   * we will use this CID as the root of the dag to walk.
   *
   * This allows us to include blocks for path parents, but those are "extra", do not belong to the DAG of exported
   * file, but act as a proof that file DAG belongs to some other parent DAG. This proof can be disregarded if the user
   * only cares about file, without its provenance.
   *
   * If you provide `knownDagPath` and no `dagRoot`, the first CID in `knownDagPath` will be used as `dagRoot`.
   */
  dagRoot?: CID

  /**
   * An ordered array of CIDs representing the known path from dagRoot to the target root.
   * The array should start with dagRoot (at index 0) and end with the target root CID.
   *
   * This allows optimizing the path traversal by skipping the expensive path-finding process
   * when the path from dagRoot to the target root is already known, reducing network requests
   * and computation time.
   *
   * Example usage:
   * ```typescript
   * await c.export(targetCid, writer, {
   *   dagRoot: rootCid,
   *   knownDagPath: [rootCid, ...intermediateCids, targetCid]
   * })
   * ```
   *
   * Note: If any CID in the path cannot be found in the blockstore, the code
   * will automatically fall back to the regular path-finding algorithm.
   */
  knownDagPath?: CID[]
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

// DAG-PB codec code (0x70) - used for identifying UnixFS data
const DAG_PB_CODEC_CODE = 0x70

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
    }

    // If dagRoot is specified and knownDagPath is provided, use the known path
    if (options?.dagRoot != null && options?.knownDagPath != null && options.knownDagPath.length > 0) {
      const knownPath = options.knownDagPath
      void queue.add(async () => {
        await this.#processCIDsInKnownPath(knownPath, queue, writer, options)
      })
        .catch(() => {})
    } else if (options?.dagRoot != null) {
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
   * to export blocks that are in that path. Respects the dagScope option
   * when a target root is found.
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
    // TODO: We need to handle the case where users might want to process multiple target roots, with different knownDagPaths
    const isTargetRoot = targetRoots.some(r => r.equals(dagRoot))

    if (isTargetRoot) {
      // If we've found a target root, respect the dag scope
      const block = createUnsafe({ bytes, cid: dagRoot, codec })

      // If dagScope is BLOCK, don't walk the DAG at all
      if (options?.dagScope === DagScope.BLOCK) {
        return
      }

      // If dagScope is ENTITY, only walk the DAG for UnixFS data (dag-pb codec)
      if (options?.dagScope === DagScope.ENTITY && dagRoot.code !== DAG_PB_CODEC_CODE) {
        return
      }

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
   * and update the pin count for them. Respects the dagScope option:
   * - BLOCK: Only include the root block
   * - ENTITY: For UnixFS data (dag-pb codec), include all blocks; for non-UnixFS, only the root block
   * - ALL: Include all blocks in the DAG (default)
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

    // If dagScope is BLOCK, don't walk the DAG at all
    if (options?.dagScope === DagScope.BLOCK) {
      return
    }

    // If dagScope is ENTITY, only walk the DAG for UnixFS data (dag-pb codec)
    if (options?.dagScope === DagScope.ENTITY && cid.code !== DAG_PB_CODEC_CODE) { // 0x70 is the code for dag-pb
      return
    }

    // walk dag, ensure all blocks are present
    for await (const [,cid] of block.links()) {
      void queue.add(async () => {
        await this.#walkDag(cid, queue, writer, options)
      })
    }
  }

  /**
   * Process CIDs in the known path. For the last CID in the path (the target root),
   * respect the dagScope option to control how much of the DAG is traversed.
   */
  async #processCIDsInKnownPath (
    cids: CID[],
    queue: PQueue,
    writer: Pick<CarWriter, 'put'>,
    options?: ExportCarOptions
  ): Promise<void> {
    if (cids.length === 0) {
      return
    }

    // Process each CID in the path
    for (let i = 0; i < cids.length; i++) {
      const cid = cids[i]

      // Skip this block if it's already been processed
      if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
        continue
      }

      try {
        const codec = await this.components.getCodec(cid.code)
        const bytes = await this.components.blockstore.get(cid, options)

        // Mark the block as processed
        options?.blockFilter?.add(cid.multihash.bytes)

        // Add the block
        await writer.put({ cid, bytes })

        // If this is the last CID in the path (the target root),
        // respect the dag scope
        if (i === cids.length - 1) {
          const block = createUnsafe({ bytes, cid, codec })

          // If dagScope is BLOCK, don't walk the DAG at all
          if (options?.dagScope === DagScope.BLOCK) {
            continue
          }

          // If dagScope is ENTITY, only walk the DAG for UnixFS data (dag-pb codec)
          if (options?.dagScope === DagScope.ENTITY && cid.code !== DAG_PB_CODEC_CODE) { // 0x70 is the code for dag-pb
            continue
          }

          // Walk all links in the target root's DAG
          for await (const [, linkedCid] of block.links()) {
            void queue.add(async () => {
              await this.#walkDag(linkedCid, queue, writer, options)
            })
          }
        }
      } catch (err) {
        // If we can't get a block in the known path, fall back to regular dag walking
        // from this point forward
        if (i === 0 && options?.dagRoot != null) {
          // If it's the very first block and we have dagRoot, fall back to findPathAndWalkDag
          await this.#findPathAndWalkDag(options.dagRoot, [cids[cids.length - 1]], queue, writer, options)
          return
        } else if (i < cids.length - 1) {
          // For intermediate blocks, use the next CID in the path as the target
          await this.#findPathAndWalkDag(cid, [cids[i + 1]], queue, writer, options)
          return
        } else {
          // For the last block, just walk its DAG
          await this.#walkDag(cid, queue, writer, options)
          return
        }
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
