import { TypedEventEmitter } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { MemoryDatastore } from 'datastore-core'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { IPNS } from '../../src/ipns.ts'
import type { IPNSRouting } from '../../src/index.ts'
import type { HeliaEvents, Routing, Keychain } from '@helia/interface'
import type { Logger } from '@libp2p/logger'
import type { Datastore } from 'interface-datastore'
import type { StubbedInstance } from 'sinon-ts'

export interface CreateIPNSResult {
  name: IPNS
  customRouting: StubbedInstance<IPNSRouting>
  heliaRouting: StubbedInstance<Routing>
  keychain: StubbedInstance<Keychain>
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
  const events = new TypedEventEmitter<HeliaEvents>()
  const getCryptoKey = Sinon.stub()
  const keychain = stubInterface<Keychain>()

  const name = new IPNS({
    datastore,
    routing: heliaRouting,
    logger,
    events,
    getCryptoKey,
    keychain
  }, {
    routers: [customRouting]
  })

  return {
    name,
    customRouting,
    heliaRouting,
    keychain,
    datastore,
    log: logger.forComponent('helia:ipns:test'),
    events
  }
}
