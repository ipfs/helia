import { generateKeyPair } from '@libp2p/crypto/keys'
import { keychain } from '@libp2p/keychain'
import { defaultLogger } from '@libp2p/logger'
import { Key } from 'interface-datastore'
import { createLibp2p as create } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { DefaultLibp2pServices } from './libp2p-defaults.js'
import type { ComponentLogger, Libp2p, PrivateKey } from '@libp2p/interface'
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
  privateKey?: PrivateKey
  keychain?: KeychainInit
  dns?: DNS
}

export async function createLibp2p <T extends Record<string, unknown> = DefaultLibp2pServices> (options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  const privateKey = options.libp2p?.privateKey
  const logger = options.logger ?? defaultLogger()
  const selfKey = new Key('/pkcs8/self')
  let chain: Keychain | undefined

  // if no peer id was passed, try to load it from the keychain
  if (privateKey == null && options.datastore != null) {
    chain = keychain(options.keychain)({
      datastore: options.datastore,
      logger
    })

    options.libp2p = options.libp2p ?? {}

    if (await options.datastore.has(selfKey)) {
      // load the peer id from the keychain
      options.libp2p.privateKey = await chain.exportKey('self')
    } else {
      const privateKey = await generateKeyPair('Ed25519')
      options.libp2p.privateKey = privateKey

      // persist the peer id in the keychain for next time
      await chain.importKey('self', privateKey)
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

  return node
}
