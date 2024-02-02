import { walkPath as exporterWalk, type ExporterOptions, type ReadableStorage, type UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

export interface PathWalkerOptions extends ExporterOptions {

}
export interface PathWalkerResponse {
  ipfsRoots: CID[]
  terminalElement: UnixFSEntry

}

export interface PathWalkerFn {
  (blockstore: ReadableStorage, path: string, options?: PathWalkerOptions): Promise<PathWalkerResponse>
}

export async function walkPath (blockstore: ReadableStorage, path: string, options?: PathWalkerOptions): Promise<PathWalkerResponse> {
  const ipfsRoots: CID[] = []
  let terminalElement: UnixFSEntry | undefined

  for await (const entry of exporterWalk(path, blockstore, options)) {
    ipfsRoots.push(entry.cid)
    terminalElement = entry
  }

  if (terminalElement == null) {
    throw new Error('No terminal element found')
  }

  return {
    ipfsRoots,
    terminalElement
  }
}
