import { type ByteStream, type DirectoryCandidate, type FileCandidate, importBytes, importByteStream, type ImportCandidateStream, importDirectory, importer, type ImporterOptions, importFile, type ImportResult } from 'ipfs-unixfs-importer'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import type { PutStore } from '../unixfs.js'
import type { CID } from 'multiformats/cid'

/**
 * Default importer settings match Filecoin
 */
const defaultImporterSettings: ImporterOptions = {
  cidVersion: 1,
  rawLeaves: true,
  layout: balanced({
    maxChildrenPerNode: 1024
  }),
  chunker: fixedSize({
    chunkSize: 1048576
  })
}

export async function * addAll (source: ImportCandidateStream, blockstore: PutStore, options: Partial<ImporterOptions> = {}): AsyncGenerator<ImportResult, void, unknown> {
  yield * importer(source, blockstore, {
    ...defaultImporterSettings,
    ...options
  })
}

export async function addBytes (bytes: Uint8Array, blockstore: PutStore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importBytes(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addByteStream (bytes: ByteStream, blockstore: PutStore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importByteStream(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addFile (file: FileCandidate, blockstore: PutStore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importFile(file, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addDirectory (dir: Partial<DirectoryCandidate>, blockstore: PutStore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importDirectory({
    ...dir,
    path: dir.path ?? '-'
  }, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}
