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

  it('should throw an error when attempting to republish with an invalid key', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const otherEd25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
    await expect(name.republishRecord(otherEd25519Key.publicKey.toMultihash(), ed25519Record)).to.be.rejected
  })

  it('should republish using the embedded public key', async () => {
    const rsaKey = await generateKeyPair('RSA') // RSA will embed the public key in the record
    const otherKey = await generateKeyPair('RSA')
    const rsaRecord = await createIPNSRecord(rsaKey, testCid, 1n, 24 * 60 * 60 * 1000)
    await expect(name.republishRecord(otherKey.publicKey.toMultihash(), rsaRecord)).to.not.be.rejected
  })

  it('should republish a record using provided public key', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
    await expect(name.republishRecord(ed25519Key.publicKey.toMultihash(), ed25519Record)).to.not.be.rejected
  })

  it('should republish a record using a string key (base58btc encoded multihash)', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
    const keyString = ed25519Key.publicKey.toString()
    await expect(name.republishRecord(keyString, ed25519Record)).to.not.be.rejected
  })

  it('should republish a record using a string key (base36 encoded CID)', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
    const keyString = ed25519Key.publicKey.toCID().toString(base36)
    await expect(name.republishRecord(keyString, ed25519Record)).to.not.be.rejected
  })

  it('should republish a record using a string key (base32 encoded CID)', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)
    const keyString = ed25519Key.publicKey.toCID().toString(base32)
    await expect(name.republishRecord(keyString, ed25519Record)).to.not.be.rejected
  })

  it('should emit progress events on error', async () => {
    const ed25519Key = await generateKeyPair('Ed25519')
    const otherEd25519Key = await generateKeyPair('Ed25519')
    const ed25519Record = await createIPNSRecord(ed25519Key, testCid, 1n, 24 * 60 * 60 * 1000)

    await expect(
      name.republishRecord(otherEd25519Key.publicKey.toMultihash(), ed25519Record, {
        onProgress: (evt) => {
          expect(evt.type).to.equal('ipns:republish:error')
        }
      })
    ).to.eventually.be.rejected
  })
})
