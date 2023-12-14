import { keychain } from '@libp2p/keychain'
import { defaultLogger } from '@libp2p/logger'
import { Key } from 'interface-datastore'
import { createLibp2p as create } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { DefaultLibp2pServices } from './libp2p-defaults.js'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
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
}

export async function createLibp2p <T extends Record<string, unknown> = DefaultLibp2pServices> (options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  let peerId = options.libp2p?.peerId
  const logger = options.logger ?? defaultLogger()

  // if no peer id was passed, try to load it from the keychain
  if (peerId == null) {
    const chain = keychain(options.keychain)({
      datastore: options.datastore,
      logger
    })

    const selfKey = new Key('/pkcs8/self')

    if (await options.datastore.has(selfKey)) {
      // load the peer id from the keychain
      peerId = await chain.exportPeerId('self')
    }
  }

  const defaults = libp2pDefaults(options)
  options = options ?? {}

  // @ts-expect-error derived ServiceMap is not compatible with ServiceFactoryMap
  return create({
    ...defaults,
    ...options.libp2p,
    start: false
  })
}
