import { logger } from '@libp2p/logger'
import mergeOpts from 'merge-options'
import { InvalidParametersError } from '../errors.js'
import { cidToDirectory } from './utils/cid-to-directory.js'
import { SHARD_SPLIT_THRESHOLD_BYTES } from './utils/constants.js'
import { removeLink } from './utils/remove-link.js'
import type { RmOptions } from '../index.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:rm')

const defaultOptions: RmOptions = {
  shardSplitThresholdBytes: SHARD_SPLIT_THRESHOLD_BYTES
}

export async function rm (target: CID, name: string, blockstore: Blockstore, options: Partial<RmOptions> = {}): Promise<CID> {
  const opts: RmOptions = mergeOptions(defaultOptions, options)

  if (name.includes('/')) {
    throw new InvalidParametersError('Name must not have slashes')
  }

  const directory = await cidToDirectory(target, blockstore, opts)

  log('Removing %s from %c', name, target)

  const result = await removeLink(directory, name, blockstore, {
    ...opts,
    cidVersion: target.version
  })

  return result.cid
}
