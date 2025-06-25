import { keychain } from '@libp2p/keychain'
import { defaultLogger } from '@libp2p/logger'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { stubInterface } from 'sinon-ts'
import { ipns } from '../../src/index.js'
import type { IPNS, IPNSRouting } from '../../src/index.js'
import type { Routing } from '@helia/interface'
import type { Keychain, KeychainInit } from '@libp2p/keychain'
import type { DNS } from '@multiformats/dns'
import type { Datastore } from 'interface-datastore'
import type { StubbedInstance } from 'sinon-ts'

export interface CreateIPNSResult {
  name: IPNS
  customRouting: StubbedInstance<IPNSRouting>
  heliaRouting: StubbedInstance<Routing>
  dns: StubbedInstance<DNS>
  ipnsKeychain: Keychain
  datastore: Datastore
}

export async function createIPNS (): Promise<CreateIPNSResult> {
  const datastore = new MemoryDatastore()

  // Create stubbed instances if not provided
  const customRouting = stubInterface<IPNSRouting>()
  customRouting.get.throws(new Error('Not found'))

  const heliaRouting = stubInterface<Routing>()
  const dns = stubInterface<DNS>()

  const keychainInit: KeychainInit = {
    pass: 'very-strong-password'
  }
  const ipnsKeychain = keychain(keychainInit)({
    datastore,
    logger: defaultLogger()
  })

  const name = ipns({
    datastore,
    routing: heliaRouting,
    dns,
    libp2p: {
      services: {
        keychain: ipnsKeychain
      }
    } as any,
    logger: defaultLogger()
  }, {
    routers: [customRouting]
  })

  return {
    name,
    customRouting,
    heliaRouting,
    dns,
    ipnsKeychain,
    datastore
  }
}
