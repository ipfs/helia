import { createLibp2p as create } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { DefaultLibp2pServices } from './libp2p-defaults.js'
import type { ComponentLogger, Libp2p, PeerId } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'
import type { Libp2pOptions } from 'libp2p'

export interface CreateLibp2pOptions<T extends Record<string, unknown>> {
  datastore: Datastore
  libp2p?: Libp2pOptions<T>
  logger?: ComponentLogger
  start?: boolean
}

export interface Libp2pDefaultsOptions {
  peerId?: PeerId
}

export async function createLibp2p <T extends Record<string, unknown> = DefaultLibp2pServices> (options: CreateLibp2pOptions<T>): Promise<Libp2p<T>> {
  const defaults = libp2pDefaults()
  options = options ?? {}

  // @ts-expect-error derived ServiceMap is not compatible with ServiceFactoryMap
  return create({
    ...defaults,
    ...options.libp2p,
    start: false
  })
}
