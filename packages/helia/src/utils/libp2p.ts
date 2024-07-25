import { keychain } from '@libp2p/keychain'
import { defaultLogger } from '@libp2p/logger'
import { Key } from 'interface-datastore'
import { createLibp2p as create } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { DefaultLibp2pServices } from './libp2p-defaults.js'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { Keychain, KeychainInit } from '@libp2p/keychain'
import type { DNS } from '@multiformats/dns'
import type { Datastore } from 'interface-datastore'
import type { Libp2pOptions } from 'libp2p'

export interface CreateLibp2pOptions<T extends Record<string, unknown>> {
  datastore: Datastore
  libp2p?: Libp2pOptions<T>
  logger?: ComponentLogger
  keychain?: KeychainInit
  start?: boolean
}

export interface Libp2pDefaultsOptions {
  peerId?: PeerId
  keychain?: KeychainInit
  dns?: DNS
}

export async function createLibp2p <T extends Record<string, unknown> = DefaultLibp2pServices> (options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  const peerId = options.libp2p?.peerId
  const logger = options.logger ?? defaultLogger()
  const selfKey = new Key('/pkcs8/self')
  let chain: Keychain | undefined

  // if no peer id was passed, try to load it from the keychain
  if (peerId == null && options.datastore != null) {
    chain = keychain(options.keychain)({
      datastore: options.datastore,
      logger
    })

    if (await options.datastore.has(selfKey)) {
      // load the peer id from the keychain
      options.libp2p = options.libp2p ?? {}
      options.libp2p.peerId = await chain.exportPeerId('self')
    }
  }

  const defaults = libp2pDefaults(options)
  defaults.datastore = defaults.datastore ?? options.datastore
  options = options ?? {}

  // @ts-expect-error derived ServiceMap is not compatible with ServiceFactoryMap
  const node = await create({
    ...defaults,
    ...options.libp2p,
    start: false
  })

  if (peerId == null && chain != null && !await options.datastore.has(selfKey)) {
    // persist the peer id in the keychain for next time
    await chain.importPeer('self', node.peerId)
  }

  return node
}
