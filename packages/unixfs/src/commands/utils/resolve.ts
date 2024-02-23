import { logger } from '@libp2p/logger'
import { walkPath } from 'ipfs-unixfs-exporter'
import { InvalidParametersError } from '../../errors.js'
import { addLink } from './add-link.js'
import { cidToDirectory } from './cid-to-directory.js'
import { cidToPBLink } from './cid-to-pblink.js'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
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

export async function resolve (cid: CID, path: string | undefined, blockstore: Blockstore, options: AbortOptions): Promise<ResolveResult> {
  if (path == null || path === '') {
    return { cid }
  }

  log('resolve "%s" under %c', path, cid)

  const segments: Segment[] = [{
    name: '',
    cid,
    size: 0n
  }]

  const parts = path.split('/').filter(Boolean)

  const combinedPath = `/ipfs/${cid.toString()}/${path}`

  const pathElems = walkPath(combinedPath, blockstore, options)
  let i = 0
  let lastCid = cid

  // TODO: Do we need to catch errors during enumeration and wrap them?
  // For example do we need a DoesNotExistError if the path doesn't exist?
  // Should the other errors be handled along with any caught errors rather than separately?
  for await (const e of pathElems) {
    const name = parts[i]
    i++
    log('resolving "%s"', name, e)

    if (e.type === 'file') {
      if (i < parts.length - 1) {
        throw new InvalidParametersError('Path was invalid')
      }
    }
    lastCid = e.cid

    segments.push({
      name: name,
      cid: e.cid,
      size: e.size
    })
  }

  if (i < parts.length - 1) {
    throw new InvalidParametersError('Path was invalid')
  }

  log('resolved %s to %c', path, lastCid)

  return {
    cid,
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
export async function updatePathCids (cid: CID, result: ResolveResult, blockstore: Blockstore, options: UpdatePathCidsOptions): Promise<CID> {
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
