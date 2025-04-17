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
 * import { car } from '@helia/car
 * import { CID } from 'multiformats/cid'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia()
 * const cid = CID.parse('QmFoo...')
 *
 * const c = car(helia)
 * const out = nodeFs.createWriteStream('example.car')
 *
 * for await (const buf of c.stream(cid)) {
 *   out.write(buf)
 * }
 *
 * out.end()
 * ```
 *
 * @example Exporting a part of a UnixFS DAG as a CAR file
 *
 * ```typescript
 * import { createHelia } from 'helia'
 * import { car, UnixFSPath } from '@helia/car
 * import { CID } from 'multiformats/cid'
 * import nodeFs from 'node:fs'
 *
 * const helia = await createHelia()
 * const cid = CID.parse('QmFoo...')
 *
 * const c = car(helia)
 * const out = nodeFs.createWriteStream('example.car')
 *
 * for await (const buf of c.stream(cid, {
 *   traversal: new UnixFSPath('/foo/bar/baz.txt')
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
 * await c.import(reader)
 * ```
 */

import { Car as CarClass } from './car.js'
import type { CodecLoader } from '@helia/interface'
import type { PutManyBlocksProgressEvents, GetBlockProgressEvents } from '@helia/interface/blocks'
import type { CarWriter, CarReader } from '@ipld/car'
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
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
  traverse<T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined>

  /**
   * Returns true if the current CID is the target and we should switch to the
   * export strategy
   */
  isTarget(cid: CID): boolean
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
  export<T extends BlockView<any, any, any, 0 | 1>>(cid: CID, block: T): AsyncGenerator<CID, void, undefined>
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
   * `dag-scope` of the exported car file.
   */
  exporter?: ExportStrategy
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

/**
 * Create a {@link Car} instance for use with {@link https://github.com/ipfs/helia Helia}
 */
export function car (helia: CarComponents, init: any = {}): Car {
  return new CarClass(helia, init)
}
