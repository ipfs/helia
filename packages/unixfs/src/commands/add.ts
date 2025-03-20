import { importBytes, importByteStream, importer } from 'ipfs-unixfs-importer'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import first from 'it-first'
import last from 'it-last'
import { InvalidParametersError } from '../errors.js'
import type { FileCandidate, AddOptions, AddFileOptions } from '../index.js'
import type { PutStore } from '../unixfs.js'
import type { ByteStream, DirectoryCandidate, ImportCandidateStream, ImportResult } from 'ipfs-unixfs-importer'
import type { CID } from 'multiformats/cid'

/**
 * Default importer settings match Filecoin
 */
const defaultImporterSettings: AddOptions = {
  cidVersion: 1,
  rawLeaves: true,
  layout: balanced({
    maxChildrenPerNode: 1024
  }),
  chunker: fixedSize({
    chunkSize: 1_048_576
  })
}

export async function * addAll (source: ImportCandidateStream, blockstore: PutStore, options: Partial<AddOptions> = {}): AsyncGenerator<ImportResult, void, unknown> {
  yield * importer(source, blockstore, {
    ...defaultImporterSettings,
    ...options
  })
}

export async function addBytes (bytes: Uint8Array, blockstore: PutStore, options: Partial<AddFileOptions> = {}): Promise<CID> {
  const { cid } = await importBytes(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addByteStream (bytes: ByteStream, blockstore: PutStore, options: Partial<AddFileOptions> = {}): Promise<CID> {
  const { cid } = await importByteStream(bytes, blockstore, {
    ...defaultImporterSettings,
    ...options
  })

  return cid
}

export async function addFile (file: FileCandidate, blockstore: PutStore, options: Partial<AddFileOptions> = {}): Promise<CID> {
  if (file.path == null) {
    throw new InvalidParametersError('path is required')
  }

  if (file.content == null) {
    throw new InvalidParametersError('content is required')
  }

  const result = await last(addAll([file], blockstore, {
    ...defaultImporterSettings,
    ...options,
    wrapWithDirectory: true
  }))

  if (result == null) {
    throw new InvalidParametersError('Nothing imported')
  }

  return result.cid
}

export async function addDirectory (dir: Partial<DirectoryCandidate>, blockstore: PutStore, options: Partial<AddFileOptions> = {}): Promise<CID> {
  // @ts-expect-error field is not in the types
  if (dir.content != null) {
    throw new InvalidParametersError('Directories cannot have content, use addFile instead')
  }

  const ord = dir.path == null ? first : last

  const result = await ord(addAll([{
    ...dir,
    path: dir.path ?? '-'
  }], blockstore, {
    ...defaultImporterSettings,
    ...options,
    wrapWithDirectory: dir.path != null
  }))

  if (result == null) {
    throw new InvalidParametersError('Nothing imported')
  }

  return result.cid
}
