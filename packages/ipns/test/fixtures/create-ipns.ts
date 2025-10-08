import { TypedEventEmitter } from '@libp2p/interface'
import { keychain } from '@libp2p/keychain'
import { defaultLogger } from '@libp2p/logger'
import { MemoryDatastore } from 'datastore-core'
import { stubInterface } from 'sinon-ts'
import { IPNS } from '../../src/ipns.ts'
import type { IPNSRouting } from '../../src/index.js'
import type { HeliaEvents, Routing } from '@helia/interface'
import type { Keychain, KeychainInit } from '@libp2p/keychain'
import type { Logger } from '@libp2p/logger'
import type { Datastore } from 'interface-datastore'
import type { StubbedInstance } from 'sinon-ts'

export interface CreateIPNSResult {
  name: IPNS
  customRouting: StubbedInstance<IPNSRouting>
  heliaRouting: StubbedInstance<Routing>
  ipnsKeychain: Keychain
  datastore: Datastore,
  log: Logger
  events: TypedEventEmitter<HeliaEvents>
}

export async function createIPNS (): Promise<CreateIPNSResult> {
  const datastore = new MemoryDatastore()

  // Create stubbed instances if not provided
  const customRouting = stubInterface<IPNSRouting>()
  customRouting.get.throws(new Error('Not found'))

  const heliaRouting = stubInterface<Routing>()

  const logger = defaultLogger()
  const keychainInit: KeychainInit = {
    pass: 'very-strong-password'
  }
  const ipnsKeychain = keychain(keychainInit)({
    datastore,
    logger
  })

  const events = new TypedEventEmitter<HeliaEvents>()

  const name = new IPNS({
    datastore,
    routing: heliaRouting,
    libp2p: {
      status: 'stopped',
      services: {
        keychain: ipnsKeychain
      }
    } as any,
    logger,
    events
  }, {
    routers: [customRouting]
  })

  return {
    name,
    customRouting,
    heliaRouting,
    ipnsKeychain,
    datastore,
    log: logger.forComponent('helia:ipns:test'),
    events
  }
}
