/**
 * @packageDocumentation
 *
 * `@helia/car` provides `import` and `export` methods to read/write Car files
 * to {@link https://github.com/ipfs/helia Helia}'s blockstore.
 *
 * See the {@link Car} interface for all available operations.
 *
 * By default it supports `dag-pb`, `dag-cbor`, `dag-json` and `raw` CIDs, more
 * esoteric DAG walkers can be passed as an init option.
 *
 * @example Exporting a DAG as a CAR file
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car } from '@helia/car'
 * import { CID } from 'multiformats/cid'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia()
 * const cid = CID.parse('QmFoo...')
 *
 * const c = car(helia)
 * const out = nodeFs.createWriteStream('example.car')
 *
 * for await (const buf of c.export(cid, {
 *   signal: AbortSignal.timeout(5_000)
 * })) {
 *   out.write(buf)
 * }
 *
 * out.end()
 * ```
 *
 * @example Exporting a part of a UnixFS DAG as a CAR file
 *
 * Here the graph traversal will start at `root` and include the blocks for
 * `root`, `/foo`, `/bar`, and all the blocks that make up `baz.txt`.
 *
 * If there are other files/directories in the UnixFS DAG under `root`, they
 * will not be included.
 *
 * `root` will be the only entry in the CAR file roots.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car, UnixFSPath } from '@helia/car'
 * import { CID } from 'multiformats/cid'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia()
 * const root = CID.parse('QmFoo...')
 *
 * const c = car(helia)
 * const out = nodeFs.createWriteStream('example.car')
 *
 * for await (const buf of c.export(root, {
 *   signal: AbortSignal.timeout(5_000),
 *   traversal: new UnixFSPath('/foo/bar/baz.txt')
 * })) {
 *   out.write(buf)
 * }
 *
 * out.end()
 * ```
 *
 * @example Including traversal path above the root in a CAR
 *
 * The `includeTraversalBlocks` option will include the traversal blocks in the
 * CAR when they would otherwise be excluded (for example when the traversal
 * starts in a parent of the export root).
 *
 * Here `baz` is the CID for `baz.txt`.
 *
 * The CAR file will include the blocks for `parent`, `/foo`, `/bar`, and
 * `/baz.txt`.
 *
 * `baz` will be the only entry in the CAR file roots.
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car, UnixFSPath } from '@helia/car'
 * import { CID } from 'multiformats/cid'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia()
 * const parent = CID.parse('QmFoo...')
 * const baz = CID.parse('QmBar...')
 *
 * const c = car(helia)
 * const out = nodeFs.createWriteStream('example.car')
 *
 * for await (const buf of c.export(baz, {
 *   signal: AbortSignal.timeout(5_000),
 *   traversal: new UnixFSPath(parent, '/foo/bar/baz.txt'),
 *   includeTraversalBlocks: true
 * })) {
 *   out.write(buf)
 * }
 *
 * out.end()
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
 * await c.import(reader, {
 *   signal: AbortSignal.timeout(5_000)
 * })
 * ```
 */

import { Car as CarClass } from './car.js'
import type { CodecLoader } from '@helia/interface'
import type { PutManyBlocksProgressEvents, GetBlockProgressEvents, ProviderOptions } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils'
import type { Blockstore } from 'interface-blockstore'
import type { BlockView } from 'multiformats/block/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface CarComponents {
  logger: ComponentLogger
  blockstore: Blockstore
  getCodec: CodecLoader
}

/**
 * Interface for different traversal strategies.
 *
 * While traversing the DAG, it will yield blocks that it has traversed.
 */
export interface TraversalStrategy {
  /**
   * Traverse the DAG and yield the next CID to traverse
   */
  traverse(root: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined>
}

/**
 * Interface for different export strategies.
 *
 * When traversal has ended the export begins starting at the target CID, and
 * the export strategy may do further traversal and writing to the car file.
 */
export interface ExportStrategy {
  /**
   * Export the DAG and yield the next CID to traverse
   */
  export(cid: CID, blockstore: Blockstore, getCodec: CodecLoader, options?: AbortOptions): AsyncGenerator<BlockView<unknown, number, number, 0 | 1>, void, undefined>
}

export * from './export-strategies/index.js'
export * from './traversal-strategies/index.js'

// re-export walkers from @helia/utils so consumers don't need an extra dep
export type { GraphWalker } from '@helia/utils'
export { depthFirstWalker, breadthFirstWalker, naturalOrderWalker } from '@helia/utils'

export interface ExportCarOptions extends AbortOptions, ProgressOptions<GetBlockProgressEvents>, ProviderOptions {
  /**
   * If true, the blockstore will not do any network requests.
   *
   * @default false
   */
  offline?: boolean

  /**
   * If a filter is passed it will be used to deduplicate blocks exported in the
   * car file
   */
  blockFilter?: Filter

  /**
   * The traversal strategy to use for the export. This determines how the dag
   * is traversed: either depth first, breadth first, or a custom strategy.
   */
  traversal?: TraversalStrategy

  /**
   * Export strategy to use for the export. This should be used to change the
   * blocks included in the exported car file. (e.g. https://specs.ipfs.tech/http-gateways/trustless-gateway/#dag-scope-request-query-parameter)
   */
  exporter?: ExportStrategy

  /**
   * If `true`, and the traversal strategy starts above the root, include the
   * traversed blocks in the CAR file before the root and subsequent blocks
   *
   * @default false
   */
  includeTraversalBlocks?: boolean
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
   * Returns an AsyncGenerator that yields CAR file bytes.
   *
   * @example
   *
   * ```typescript
   * import { createHelia } from 'helia'
   * import { car } from '@helia/car'
   * import { CID } from 'multiformats/cid'
   *
   * const helia = await createHelia()
   * const cid = CID.parse('QmFoo...')
   *
   * const c = car(helia)
   *
   * for (const buf of c.export(cid)) {
   *   // store or send `buf` somewhere
   * }
   * ```
   */
  export(root: CID | CID[], options?: ExportCarOptions): AsyncGenerator<Uint8Array, void, undefined>
}

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: CarComponents): Car {
  return new CarClass(helia)
}
