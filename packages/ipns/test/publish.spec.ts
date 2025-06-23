/* eslint-env mocha */

import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { keychain } from '@libp2p/keychain'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'
import type { StubbedInstance } from 'sinon-ts'
import type { Keychain, KeychainInit } from '@libp2p/keychain'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
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

    name = ipns({
      datastore,
      routing: heliaRouting,
      dns,
      libp2p: {
        services: {
          keychain: ipnsKeychain
        }
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      logger: defaultLogger()
    }, {
      routers: [
        customRouting
      ]
    })
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
