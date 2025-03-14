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
