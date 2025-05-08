import { loadOrCreateSelfKey } from '@libp2p/config'
import { createLibp2p as create } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { ComponentLogger, Libp2p, PrivateKey } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
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
  privateKey?: PrivateKey
  keychain?: KeychainInit
  dns?: DNS
}

export async function createLibp2p <T extends Record<string, unknown>> (options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  const libp2pOptions = options.libp2p ?? {}

  // if no peer id was passed, try to load it from the keychain
  if (libp2pOptions.privateKey == null && options.datastore != null) {
    libp2pOptions.privateKey = await loadOrCreateSelfKey(options.datastore, options.keychain)
  }

  const defaults: any = libp2pDefaults(libp2pOptions)
  defaults.datastore = defaults.datastore ?? options.datastore

  const node = await create<T>({
    ...defaults,
    ...libp2pOptions,
    start: false
  })

  return node
}
