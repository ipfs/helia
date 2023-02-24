import type { CID } from 'multiformats/cid'
import type { Blockstore } from 'interface-blockstore'
import { ByteStream, DirectoryCandidate, FileCandidate, importBytes, importByteStream, ImportCandidateStream, importDirectory, importer, ImporterOptions, importFile, ImportResult } from 'ipfs-unixfs-importer'

export async function * addAll (source: ImportCandidateStream, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): AsyncGenerator<ImportResult, void, unknown> {
  yield * importer(source, blockstore, options)
}

export async function addBytes (bytes: Uint8Array, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importBytes(bytes, blockstore, options)

  return cid
}

export async function addByteStream (bytes: ByteStream, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importByteStream(bytes, blockstore, options)

  return cid
}

export async function addFile (file: FileCandidate, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importFile(file, blockstore, options)

  return cid
}

export async function addDirectory (dir: Partial<DirectoryCandidate>, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importDirectory({
    ...dir,
    path: dir.path ?? '-'
  }, blockstore, options)

  return cid
}
