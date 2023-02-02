import type { Blockstore } from 'interface-blockstore'
import { ImportCandidate, importer, ImportResult, UserImporterOptions } from 'ipfs-unixfs-importer'
import last from 'it-last'
import type { CID } from 'multiformats/cid'
import { UnknownError } from './utils/errors.js'

function isIterable (obj: any): obj is Iterator<Uint8Array> {
  return obj[Symbol.iterator] != null
}

function isAsyncIterable (obj: any): obj is AsyncIterator<Uint8Array> {
  return obj[Symbol.asyncIterator] != null
}

export async function add (source: Uint8Array | Iterator<Uint8Array> | AsyncIterator<Uint8Array> | ImportCandidate, blockstore: Blockstore, options: UserImporterOptions = {}): Promise<CID> {
  let importCandidate: ImportCandidate

  if (source instanceof Uint8Array || isIterable(source) || isAsyncIterable(source)) {
    importCandidate = {
      // @ts-expect-error FIXME: work out types
      content: source
    }
  } else {
    importCandidate = source
  }

  const result = await last(importer(importCandidate, blockstore, {
    cidVersion: 1,
    rawLeaves: true,
    ...options
  }))

  if (result == null) {
    throw new UnknownError('Could not import')
  }

  return result.cid
}

export async function * addStream (source: Iterable<ImportCandidate> | AsyncIterable<ImportCandidate>, blockstore: Blockstore, options: UserImporterOptions = {}): AsyncGenerator<ImportResult> {
  yield * importer(source, blockstore, {
    cidVersion: 1,
    rawLeaves: true,
    ...options
  })
}
