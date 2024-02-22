import { CodeError } from '@libp2p/interface'
import { exporter, recursive, type UnixFSEntry } from 'ipfs-unixfs-exporter'
import map from 'it-map'
import { pipe } from 'it-pipe'
import { pack, type TarEntryHeader, type TarImportCandidate } from 'it-tar'
import type { AbortOptions } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'

const EXPORTABLE = ['file', 'raw', 'directory']

function toHeader (file: UnixFSEntry): Partial<TarEntryHeader> & { name: string } {
  let mode: number | undefined
  let mtime: Date | undefined

  if (file.type === 'file' || file.type === 'directory') {
    mode = file.unixfs.mode
    mtime = file.unixfs.mtime != null ? new Date(Number(file.unixfs.mtime.secs * 1000n)) : undefined
  }

  return {
    name: file.path,
    mode,
    mtime,
    size: Number(file.size),
    type: file.type === 'directory' ? 'directory' : 'file'
  }
}

function toTarImportCandidate (entry: UnixFSEntry): TarImportCandidate {
  if (!EXPORTABLE.includes(entry.type)) {
    throw new CodeError('Not a UnixFS node', 'ERR_NOT_UNIXFS')
  }

  const candidate: TarImportCandidate = {
    header: toHeader(entry)
  }

  if (entry.type === 'file' || entry.type === 'raw') {
    candidate.body = entry.content()
  }

  return candidate
}

export async function * tarStream (ipfsPath: string, blockstore: Blockstore, options?: AbortOptions): AsyncGenerator<Uint8Array> {
  const file = await exporter(ipfsPath, blockstore, options)

  if (file.type === 'file' || file.type === 'raw') {
    yield * pipe(
      [toTarImportCandidate(file)],
      pack()
    )

    return
  }

  if (file.type === 'directory') {
    yield * pipe(
      recursive(ipfsPath, blockstore, options),
      (source) => map(source, (entry) => toTarImportCandidate(entry)),
      pack()
    )

    return
  }

  throw new CodeError('Not a UnixFS node', 'ERR_NOT_UNIXFS')
}
