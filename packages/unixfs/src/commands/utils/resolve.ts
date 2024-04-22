import { logger } from '@libp2p/logger'
import { walkPath } from 'ipfs-unixfs-exporter'
import all from 'it-all'
import { DoesNotExistError } from '../../errors.js'
import { addLink } from './add-link.js'
import { cidToDirectory } from './cid-to-directory.js'
import { cidToPBLink } from './cid-to-pblink.js'
import type { GetStore, PutStore } from '../../unixfs.js'
import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'

const log = logger('helia:unixfs:components:utils:resolve')

export interface Segment {
  name: string
  cid: CID
  size: bigint
}

export interface ResolveResult {
  /**
   * The CID at the end of the path
   */
  cid: CID

  path?: string

  /**
   * If present, these are the CIDs and path segments that were traversed through to reach the final CID
   *
   * If not present, there was no path passed or the path was an empty string
   */
  segments?: Segment[]
}

export async function resolve (cid: CID, path: string | undefined, blockstore: GetStore, options: AbortOptions): Promise<ResolveResult> {
  if (path == null || path === '') {
    return { cid }
  }

  const p = `/ipfs/${cid}${path == null ? '' : `/${path}`}`
  const segments = await all(walkPath(p, blockstore, options))

  if (segments.length === 0) {
    throw new DoesNotExistError('Could not find path in directory')
  }

  log('resolved %s to %c', path, cid)

  return {
    cid: segments[segments.length - 1].cid,
    path,
    segments
  }
}

export interface UpdatePathCidsOptions extends AbortOptions {
  shardSplitThresholdBytes: number
}

/**
 * Where we have descended into a DAG to update a child node, ascend up the DAG creating
 * new hashes and blocks for the changed content
 */
export async function updatePathCids (cid: CID, result: ResolveResult, blockstore: PutStore & GetStore, options: UpdatePathCidsOptions): Promise<CID> {
  if (result.segments == null || result.segments.length === 0) {
    return cid
  }

  let child = result.segments.pop()

  if (child == null) {
    throw new Error('Insufficient segments')
  }

  child.cid = cid

  result.segments.reverse()

  for (const parent of result.segments) {
    const [
      directory,
      pblink
    ] = await Promise.all([
      cidToDirectory(parent.cid, blockstore, options),
      cidToPBLink(child.cid, child.name, blockstore, options)
    ])

    const result = await addLink(directory, pblink, blockstore, {
      ...options,
      allowOverwriting: true,
      cidVersion: cid.version
    })

    cid = result.cid
    parent.cid = cid
    child = parent
  }

  return cid
}
