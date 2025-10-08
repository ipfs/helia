import { logger } from '@libp2p/logger'
import { InvalidParametersError } from '../errors.js'
import { cidToDirectory } from './utils/cid-to-directory.js'
import { removeLink } from './utils/remove-link.js'
import type { RmOptions } from '../index.js'
import type { GetStore, PutStore } from '../unixfs.js'
import type { CID } from 'multiformats/cid'

const log = logger('helia:unixfs:rm')

export async function rm (target: CID, name: string, blockstore: GetStore & PutStore, options: Partial<RmOptions> = {}): Promise<CID> {
  if (name.includes('/')) {
    throw new InvalidParametersError('Name must not have slashes')
  }

  const directory = await cidToDirectory(target, blockstore, options)

  log('Removing %s from %c', name, target)

  const result = await removeLink(directory, name, blockstore, {
    ...options,
    cidVersion: target.version
  })

  return result.cid
}
