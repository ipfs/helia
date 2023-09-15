import { createLibp2p as create, type Libp2pOptions } from 'libp2p'
import { type DefaultLibp2pServices, libp2pDefaults } from './libp2p-defaults.js'
import type { Libp2p } from '@libp2p/interface'
import type { Datastore } from 'interface-datastore'

export interface CreateLibp2pOptions {
  datastore: Datastore
  start?: boolean
}

export async function createLibp2p (datastore: Datastore, options?: Libp2pOptions<any>): Promise<Libp2p<DefaultLibp2pServices>> {
  const defaults = libp2pDefaults()
  options = options ?? {}

  return create({
    datastore,
    ...defaults,
    ...options,
    start: false
  })
}
