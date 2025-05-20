import { logger } from '@libp2p/logger'
import { mergeOptions as mergeOpts } from '@libp2p/utils/merge-options'
import { InvalidParametersError } from '../errors.js'
import { addLink } from './utils/add-link.js'
import { cidToDirectory } from './utils/cid-to-directory.js'
import { cidToPBLink } from './utils/cid-to-pblink.js'
import { SHARD_SPLIT_THRESHOLD_BYTES } from './utils/constants.js'
import type { CpOptions } from '../index.js'
import type { GetStore, PutStore } from '../unixfs.js'
import type { CID } from 'multiformats/cid'

const mergeOptions = mergeOpts.bind({ ignoreUndefined: true })
const log = logger('helia:unixfs:cp')

const defaultOptions: CpOptions = {
  force: false,
  shardSplitThresholdBytes: SHARD_SPLIT_THRESHOLD_BYTES
}

export async function cp (source: CID, target: CID, name: string, blockstore: GetStore & PutStore, options: Partial<CpOptions> = {}): Promise<CID> {
  const opts: CpOptions = mergeOptions(defaultOptions, options)

  if (name.includes('/')) {
    throw new InvalidParametersError('Name must not have slashes')
  }

  const [
    directory,
    pblink
  ] = await Promise.all([
    cidToDirectory(target, blockstore, opts),
    cidToPBLink(source, name, blockstore, opts)
  ])

  log('Adding %c as "%s" to %c', source, name, target)

  const result = await addLink(directory, pblink, blockstore, {
    allowOverwriting: opts.force,
    cidVersion: target.version,
    ...opts
  })

  return result.cid
}
