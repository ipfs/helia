/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { createIPNS } from './fixtures/create-ipns.js'
import type { IPNS } from '../src/index.js'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
  let name: IPNS
  let customRouting: any
  let heliaRouting: any

  beforeEach(async () => {
    const result = await createIPNS()
    name = result.name
    customRouting = result.customRouting
    heliaRouting = result.heliaRouting
  })

  it('should publish an IPNS record with the default params', async function () {
    const keyName = 'test-key-1'
    const ipnsEntry = await name.publish(keyName, cid)

    expect(ipnsEntry.record).to.have.property('sequence', 1n)
    expect(ipnsEntry.record).to.have.property('ttl', 300_000_000_000n) // 5 minutes
  })

  it('should publish an IPNS record with a custom lifetime params', async function () {
    const keyName = 'test-key-2'
    const lifetime = 123000
    const ipnsEntry = await name.publish(keyName, cid, {
      lifetime
    })

    expect(ipnsEntry.record).to.have.property('sequence', 1n)

    // Calculate expected validity as a Date object
    const expectedValidity = new Date(Date.now() + lifetime)
    const actualValidity = new Date(ipnsEntry.record.validity)
    const timeDifference = Math.abs(actualValidity.getTime() - expectedValidity.getTime())
    expect(timeDifference).to.be.lessThan(1000)

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()
  })

  it('should publish an IPNS record with a custom ttl params', async function () {
    const keyName = 'test-key-3'
    const ttl = 1000 // override the default ttl

    const ipnsEntry = await name.publish(keyName, cid, {
      ttl
    })

    expect(ipnsEntry.record).to.have.property('sequence', 1n)
    expect(ipnsEntry.record).to.have.property('ttl', BigInt(ttl * 1e+6))

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()
  })

  it('should publish a record offline', async () => {
    const keyName = 'test-key-4'
    await name.publish(keyName, cid, {
      offline: true
    })

    expect(heliaRouting.put.called).to.be.false()
    expect(customRouting.put.called).to.be.false()
  })

  it('should emit progress events', async function () {
    const keyName = 'test-key-5'
    const onProgress = Sinon.stub()
    await name.publish(keyName, cid, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })

  it('should publish recursively', async () => {
    const keyName1 = 'test-key-6'
    const record = await name.publish(keyName1, cid, {
      offline: true
    })

    expect(record.record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const keyName2 = 'test-key-7'
    const recursiveRecord = await name.publish(keyName2, record.publicKey, {
      offline: true
    })

    expect(recursiveRecord.record.value).to.equal(`/ipns/${record.publicKey.toCID().toString(base36)}`)

    const recursiveResult = await name.resolve(record.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish record with a path', async () => {
    const path = '/foo/bar/baz'
    const fullPath = `/ipfs/${cid}/${path}`

    const keyName = 'test-key-8'
    const record = await name.publish(keyName, fullPath, {
      offline: true
    })

    expect(record.record.value).to.equal(fullPath)

    const result = await name.resolve(record.publicKey)

    expect(result.cid.toString()).to.equal(cid.toString())
    expect(result.path).to.equal(path)
  })
})
