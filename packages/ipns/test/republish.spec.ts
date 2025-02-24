/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { createIPNSRecord } from 'ipns'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRecord, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { PrivateKey } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'

describe('republishRecord', () => {
  let testCid: CID
  let rsaKey: PrivateKey
  let rsaRecord: IPNSRecord
  let ed25519Key: PrivateKey
  let ed25519Record: IPNSRecord
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>

  beforeEach(async () => {
    const datastore = new MemoryDatastore()
    customRouting = stubInterface<IPNSRouting>()
    customRouting.get.throws(new Error('Not found'))
    heliaRouting = stubInterface<Routing>()

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

    testCid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
    rsaKey = await generateKeyPair('RSA') // RSA will embed the public key in the record
    ed25519Key = await generateKeyPair('Ed25519')
    rsaRecord = await createIPNSRecord(rsaKey, testCid, 1n, 24 * 60 * 60 * 1000)
    ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
  })

  it('should republish a record using embedded public key', async () => {
    await expect(name.republishRecord(rsaRecord)).to.not.be.rejected
  })

  it('should republish a record using provided public key', async () => {
    await expect(name.republishRecord(ed25519Record, ed25519Key.publicKey)).to.not.be.rejected
  })

  it('should fail when no public key is available', async () => {
    await expect(name.republishRecord(ed25519Record)).to.be.rejectedWith(
      'No public key found to determine the routing key'
    )
  })

  it('should emit progress events on error', async () => {
    const events: Error[] = []

    await expect(
      name.republishRecord(ed25519Record, undefined, {
        onProgress: (evt) => {
          if (evt.type === 'ipns:publish:error') {
            events.push(evt.detail)
          }
        }
      })
    ).to.be.rejected

    expect(events).to.have.lengthOf(1)
  })
})
