import { type DagScope } from './dag-scope.js'
import type { CodecLoader } from '@helia/interface'
import type { GetBlockProgressEvents } from '@helia/interface/blocks'
import type { AbortOptions, ComponentLogger } from '@libp2p/interface'
import type { Filter } from '@libp2p/utils/filters'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export interface CarComponents {
  logger?: ComponentLogger
  blockstore: Blockstore
  getCodec: CodecLoader
}

/**
 * Interface for different traversal strategies
 */
export interface TraversalStrategy {
  /**
   * Determine if the strategy should traverse the given CID
   */
  shouldTraverse(cid: CID, options?: ExportCarOptions): boolean

  /**
   * Get the next CID, and potentially new strategy to traverse
   */
  getNextCidStrategy(cid: CID, block: any): AsyncGenerator<CID | { cid: CID, strategy: TraversalStrategy }, void, undefined>
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
   * If you provide `knownDagPath`, you should already have verified that the CIDs in the path are present in the blockstore.
   *
   * This allows optimizing the path traversal by skipping the expensive path-finding process
   * when the path from dagRoot to the target root is already known, reducing network requests
   * and computation time.
   *
   * @example
   *
   * ```typescript
   * await c.export(targetCid, writer, {
   *   dagRoot: rootCid,
   *   knownDagPath: [rootCid, ...intermediateCids, targetCid]
   * })
   * ```
   */
  knownDagPath?: CID[]
}
