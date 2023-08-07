import { createLibp2p as create, type Libp2pOptions } from 'libp2p'
import { libp2pDefaults } from './libp2p-defaults.js'
import type { Libp2p } from '@libp2p/interface'
import type { PubSub } from '@libp2p/interface/pubsub'
import type { DualKadDHT } from '@libp2p/kad-dht'
import type { Datastore } from 'interface-datastore'
import type { CircuitRelayService } from 'libp2p/circuit-relay'

export interface CreateLibp2pOptions {
  datastore: Datastore
  start?: boolean
}

export async function createLibp2p (datastore: Datastore, options?: Libp2pOptions<any>): Promise<Libp2p<{ dht: DualKadDHT, pubsub: PubSub, relay: CircuitRelayService }>> {
  const defaults = libp2pDefaults()
  options = options ?? {}

  return create({
    datastore,
    ...defaults,
    ...options,
    start: false
  })
}
