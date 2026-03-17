import { logger } from '@libp2p/logger'
import { InvalidParametersError } from '../errors.ts'
import { cidToDirectory } from './utils/cid-to-directory.ts'
import { removeLink } from './utils/remove-link.ts'
import type { RmOptions } from '../index.ts'
import type { GetStore, PutStore } from '../unixfs.ts'
import type { CID } from 'multiformats/cid'

const log = logger('helia:unixfs:rm')

export async function rm (target: CID, name: string, blockstore: GetStore & PutStore, options: RmOptions = {}): Promise<CID> {
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
