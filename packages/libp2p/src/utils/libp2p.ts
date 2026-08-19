import { libp2pDefaults } from './libp2p-defaults.ts'
import type { Helia } from '@helia/interface'
import type { Libp2p, PrivateKey } from '@libp2p/interface'
import type { KeychainInit } from '@libp2p/keychain'
import type { DNS } from '@multiformats/dns'
import type { Libp2pOptions } from 'libp2p'

export interface CreateLibp2pOptions<T extends Record<string, unknown>> extends Libp2pOptions<T> {
  keychain?: KeychainInit
}

export interface Libp2pDefaultsOptions {
  privateKey?: PrivateKey
  keychain?: KeychainInit
  dns?: DNS
  name?: string
  version?: string
}

export async function createLibp2pOptions <T extends Record<string, unknown>> (helia: Helia, options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  const libp2pOptions = options ?? {}

  const defaults: any = libp2pDefaults({
    ...libp2pOptions,
    nodeInfo: {
      ...libp2pOptions.nodeInfo,
      name: libp2pOptions.nodeInfo?.name ?? helia.info.name,
      version: libp2pOptions.nodeInfo?.version ?? helia.info.version
    }
  })
  defaults.datastore = defaults.datastore ?? options.datastore

  return {
    ...defaults,
    ...libp2pOptions
  }
}
