import * as dagPB from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'
import { exporter } from 'ipfs-unixfs-exporter'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { DEFAULT_CID_VERSION } from '../constants.ts'
import { InvalidParametersError, NotADirectoryError } from '../errors.js'
import { addLink } from './utils/add-link.js'
import { cidToDirectory } from './utils/cid-to-directory.js'
import { cidToPBLink } from './utils/cid-to-pblink.js'
import type { MkdirOptions } from '../index.js'
import type { GetStore, PutStore } from '../unixfs.js'

const log = logger('helia:unixfs:mkdir')

export async function mkdir (parentCid: CID, dirname: string, blockstore: GetStore & PutStore, options: Partial<MkdirOptions> = {}): Promise<CID> {
  if (dirname.includes('/')) {
    throw new InvalidParametersError('Path must not have slashes')
  }

  const entry = await exporter(parentCid, blockstore, options)

  if (entry.type !== 'directory') {
    throw new NotADirectoryError(`${parentCid.toString()} was not a UnixFS directory`)
  }

  log('creating %s', dirname)

  const metadata = new UnixFS({
    type: 'directory',
    mode: options.mode,
    mtime: options.mtime
  })

  // Persist the new parent PBNode
  const node = {
    Data: metadata.marshal(),
    Links: []
  }
  const buf = dagPB.encode(node)
  const hash = await sha256.digest(buf)
  const emptyDirCid = CID.create(options.cidVersion ?? DEFAULT_CID_VERSION, dagPB.code, hash)

  await blockstore.put(emptyDirCid, buf)

  const [
    directory,
    pblink
  ] = await Promise.all([
    cidToDirectory(parentCid, blockstore, options),
    cidToPBLink(emptyDirCid, dirname, blockstore, options)
  ])

  log('adding empty dir called %s to %c', dirname, parentCid)

  const result = await addLink(directory, pblink, blockstore, {
    ...options,
    allowOverwriting: options.force
  })

  return result.cid
}
