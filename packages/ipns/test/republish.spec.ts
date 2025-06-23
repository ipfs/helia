/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { createIPNSRecord } from 'ipns'
import { stubInterface } from 'sinon-ts'
import { keychain } from '@libp2p/keychain'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'
import type { Keychain, KeychainInit } from '@libp2p/keychain'
import { CID } from 'multiformats/cid'

describe('republish', () => {
  const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>
  let ipnsKeychain: Keychain

  beforeEach(async () => {
    const datastore = new MemoryDatastore()
    customRouting = stubInterface<IPNSRouting>()
    customRouting.get.throws(new Error('Not found'))
    heliaRouting = stubInterface<Routing>()
    dns = stubInterface<DNS>()

    const keychainInit: KeychainInit = {
      pass: 'very-strong-password'
    }
    ipnsKeychain = keychain(keychainInit)({
      datastore: new MemoryDatastore(),
      logger: defaultLogger()
    })

    name = ipns(
      {
        datastore,
        routing: heliaRouting,
        dns,
        libp2p: {
          services: {
            keychain: ipnsKeychain
          }
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        logger: defaultLogger()
      },
      {
        routers: [customRouting]
      }
    )
  })

  it('should republish using the embedded public key', async () => {
    const rsaKey = await generateKeyPair('RSA') // RSA will embed the public key in the record
    const otherKey = await generateKeyPair('RSA')
    const rsaRecord = await createIPNSRecord(rsaKey, testCid, 1n, 24 * 60 * 60 * 1000)

    await expect(name.republishRecord(otherKey.publicKey.toMultihash(), rsaRecord)).to.not.be.rejected
  })
})
