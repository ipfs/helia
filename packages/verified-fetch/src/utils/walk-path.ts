import { walkPath as exporterWalk, type ExporterOptions, type ReadableStorage, type UnixFSEntry } from 'ipfs-unixfs-exporter'

export interface PathWalkerOptions extends ExporterOptions {

}
export interface PathWalkerResponse {
  ipfsRoots: string[]
  terminalElement: UnixFSEntry

}

export interface PathWalkerFn {
  (blockstore: ReadableStorage, path: string, options?: PathWalkerOptions): Promise<PathWalkerResponse>
}

export async function walkPath (blockstore: ReadableStorage, path: string, options?: PathWalkerOptions): Promise<PathWalkerResponse> {
  const entries: UnixFSEntry[] = []
  const ipfsRoots: string[] = []
  let terminalElement: UnixFSEntry | undefined

  for await (const entry of exporterWalk(path, blockstore, options)) {
    entries.push(entry)
    ipfsRoots.push(entry.cid.toString())
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
