import type { CID } from 'multiformats/cid'
import type { Blockstore } from 'ipfs-unixfs-importer'
import { ByteStream, DirectoryCandidate, FileCandidate, importBytes, importByteStream, ImportCandidateStream, importDirectory, importer, ImporterOptions, importFile, ImportResult } from 'ipfs-unixfs-importer'
import { balanced } from 'ipfs-unixfs-importer/layout'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'

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

export async function * addAll (source: ImportCandidateStream, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): AsyncGenerator<ImportResult, void, unknown> {
  yield * importer(source, blockstore, {
    ...defaultImporterSettings,
    ...options
  })
}

export async function addBytes (bytes: Uint8Array, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importBytes(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addByteStream (bytes: ByteStream, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importByteStream(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addFile (file: FileCandidate, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importFile(file, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addDirectory (dir: Partial<DirectoryCandidate>, blockstore: Blockstore, options: Partial<ImporterOptions> = {}): Promise<CID> {
  const { cid } = await importDirectory({
    ...dir,
    path: dir.path ?? '-'
  }, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}
