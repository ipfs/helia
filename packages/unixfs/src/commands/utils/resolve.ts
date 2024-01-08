import { logger } from '@libp2p/logger'
import { exporter } from 'ipfs-unixfs-exporter'
import { DoesNotExistError, InvalidParametersError } from '../../errors.js'
import { addLink } from './add-link.js'
import { cidToDirectory } from './cid-to-directory.js'
import { cidToPBLink } from './cid-to-pblink.js'
import type { Blocks } from '@helia/interface/blocks'
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

export async function resolve (cid: CID, path: string | undefined, blockstore: Blocks, options: AbortOptions): Promise<ResolveResult> {
  if (path == null || path === '') {
    return { cid }
  }

  log('resolve "%s" under %c', path, cid)

  const parts = path.split('/').filter(Boolean)
  const segments: Segment[] = [{
    name: '',
    cid,
    size: 0n
  }]

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const result = await exporter(cid, blockstore, options)

    log('resolving "%s"', part, result)

    if (result.type === 'file') {
      if (i < parts.length - 1) {
        throw new InvalidParametersError('Path was invalid')
      }

      cid = result.cid
    } else if (result.type === 'directory') {
      let dirCid: CID | undefined

      for await (const entry of result.content()) {
        if (entry.name === part) {
          dirCid = entry.cid
          break
        }
      }

      if (dirCid == null) {
        throw new DoesNotExistError('Could not find path in directory')
      }

      cid = dirCid

      segments.push({
        name: part,
        cid,
        size: result.size
      })
    } else {
      throw new InvalidParametersError('Could not resolve path')
    }
  }

  log('resolved %s to %c', path, cid)

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
export async function updatePathCids (cid: CID, result: ResolveResult, blockstore: Blocks, options: UpdatePathCidsOptions): Promise<CID> {
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
