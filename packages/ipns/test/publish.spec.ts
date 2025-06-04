/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
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

    name = ipns({
      datastore,
      routing: heliaRouting,
      dns,
      logger: defaultLogger()
    }, {
      routers: [
        customRouting
      ]
    })
  })

  it('should publish an IPNS record with the default params', async function () {
    const key = await generateKeyPair('Ed25519')
    const ipnsEntry = await name.publish(key, cid)

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', 300_000_000_000n) // 5 minutes
  })

  it('should publish an IPNS record with a custom lifetime params', async function () {
    const key = await generateKeyPair('Ed25519')
    const lifetime = 123000
    // lifetime is used to calculate the validity timestamp
    const ipnsEntry = await name.publish(key, cid, {
      lifetime
    })

    expect(ipnsEntry).to.have.property('sequence', 1n)

    // Calculate expected validity as a Date object
    const expectedValidity = new Date(Date.now() + lifetime)

    const actualValidity = new Date(ipnsEntry.validity)

    const timeDifference = Math.abs(actualValidity.getTime() - expectedValidity.getTime())

    // Allow a tolerance of 1 second (1000 milliseconds)
    expect(timeDifference).to.be.lessThan(1000)

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()
  })

  it('should publish an IPNS record with a custom ttl params', async function () {
    const key = await generateKeyPair('Ed25519')
    const ttl = 1000 // override the default ttl

    const ipnsEntry = await name.publish(key, cid, {
      ttl
    })

    expect(ipnsEntry).to.have.property('sequence', 1n)
    expect(ipnsEntry).to.have.property('ttl', BigInt(ttl * 1e+6))

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()
  })

  it('should publish a record offline', async () => {
    const key = await generateKeyPair('Ed25519')
    await name.publish(key, cid, {
      offline: true
    })

    expect(heliaRouting.put.called).to.be.false()
    expect(customRouting.put.called).to.be.false()
  })

  it('should emit progress events', async function () {
    const key = await generateKeyPair('Ed25519')
    const onProgress = Sinon.stub()
    await name.publish(key, cid, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })

  it('should publish recursively', async () => {
    const key = await generateKeyPair('Ed25519')
    const record = await name.publish(key, cid, {
      offline: true
    })

    expect(record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const recursiveKey = await generateKeyPair('Ed25519')
    const recursiveRecord = await name.publish(recursiveKey, key.publicKey, {
      offline: true
    })

    expect(recursiveRecord.value).to.equal(`/ipns/${key.publicKey.toCID().toString(base36)}`)

    const recursiveResult = await name.resolve(recursiveKey.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish record with a path', async () => {
    const path = '/foo/bar/baz'
    const fullPath = `/ipfs/${cid}/${path}`

    const key = await generateKeyPair('Ed25519')
    const record = await name.publish(key, fullPath, {
      offline: true
    })

    expect(record.value).to.equal(fullPath)

    const result = await name.resolve(key.publicKey)

    expect(result.cid.toString()).to.equal(cid.toString())
    expect(result.path).to.equal(path)
  })
})
