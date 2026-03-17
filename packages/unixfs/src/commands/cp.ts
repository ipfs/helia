import { logger } from '@libp2p/logger'
import { InvalidParametersError } from '../errors.ts'
import { addLink } from './utils/add-link.ts'
import { cidToDirectory } from './utils/cid-to-directory.ts'
import { cidToPBLink } from './utils/cid-to-pblink.ts'
import type { CpOptions } from '../index.ts'
import type { GetStore, PutStore } from '../unixfs.ts'
import type { CID } from 'multiformats/cid'

const log = logger('helia:unixfs:cp')

export async function cp (source: CID, target: CID, name: string, blockstore: GetStore & PutStore, options: CpOptions = {}): Promise<CID> {
  if (name.includes('/')) {
    throw new InvalidParametersError('Name must not have slashes')
  }

  const [
    directory,
    pblink
  ] = await Promise.all([
    cidToDirectory(target, blockstore, options),
    cidToPBLink(source, name, blockstore, options)
  ])

  log('Adding %c as "%s" to %c', source, name, target)

  const result = await addLink(directory, pblink, blockstore, {
    allowOverwriting: options.force,
    cidVersion: target.version,
    ...options
  })

  return result.cid
}
