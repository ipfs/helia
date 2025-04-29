/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { createIPNSRecord } from 'ipns'
import { base32 } from 'multiformats/bases/base32'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { ipns } from '../src/index.js'
import { IPNS_STRING_PREFIX } from '../src/utils.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'

describe('republishRecord', () => {
  const testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>

  beforeEach(async () => {
    const datastore = new MemoryDatastore()
    customRouting = stubInterface<IPNSRouting>()
    customRouting.get.throws(new Error('Not found'))
    heliaRouting = stubInterface<Routing>()
    dns = stubInterface<DNS>()

    name = ipns(
      {
        datastore,
        routing: heliaRouting,
        dns,
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
