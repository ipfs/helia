/* eslint-env mocha */

import { start, stop } from '@libp2p/interface'
import { peerIdFromCID } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { localStore } from '../src/local-store.js'
import { createIPNS } from './fixtures/create-ipns.js'
import type { CreateIPNSResult } from './fixtures/create-ipns.js'
import type { IPNS } from '../src/ipns.js'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('publish', () => {
  let name: IPNS
  let customRouting: any
  let heliaRouting: any
  let result: CreateIPNSResult

  beforeEach(async () => {
    result = await createIPNS()
    name = result.name
    customRouting = result.customRouting
    heliaRouting = result.heliaRouting

    await start(name)
  })

  afterEach(async () => {
    await stop(name)
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

  it('should publish recursively using a public key', async () => {
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

    const recursiveResult = await name.resolve(recursiveRecord.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish recursively using a libp2p-key CID', async () => {
    const keyName1 = 'test-key-6'
    const record = await name.publish(keyName1, cid, {
      offline: true
    })

    expect(record.record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const keyName2 = 'test-key-7'
    const recursiveRecord = await name.publish(keyName2, record.publicKey.toCID(), {
      offline: true
    })

    expect(recursiveRecord.record.value).to.equal(`/ipns/${record.publicKey.toCID().toString(base36)}`)

    const recursiveResult = await name.resolve(recursiveRecord.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish recursively using a multihash', async () => {
    const keyName1 = 'test-key-8'
    const record = await name.publish(keyName1, cid, {
      offline: true
    })

    expect(record.record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const keyName2 = 'test-key-9'
    const recursiveRecord = await name.publish(keyName2, record.publicKey.toCID().multihash, {
      offline: true
    })

    expect(recursiveRecord.record.value).to.equal(`/ipns/${base36.encode(record.publicKey.toCID().multihash.bytes)}`)

    const recursiveResult = await name.resolve(recursiveRecord.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish recursively using a PeerId key', async () => {
    const keyName1 = 'test-key-10'
    const record = await name.publish(keyName1, cid, {
      offline: true
    })

    expect(record.record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const keyName2 = 'test-key-11'
    const recursiveRecord = await name.publish(keyName2, peerIdFromCID(record.publicKey.toCID()), {
      offline: true
    })

    expect(recursiveRecord.record.value).to.equal(`/ipns/${record.publicKey.toCID().toString(base36)}`)

    const recursiveResult = await name.resolve(recursiveRecord.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish recursively using a string IPNS key', async () => {
    const keyName1 = 'test-key-10'
    const record = await name.publish(keyName1, cid, {
      offline: true
    })

    expect(record.record.value).to.equal(`/ipfs/${cid.toV1().toString()}`)

    const keyName2 = 'test-key-11'
    const recursiveRecord = await name.publish(keyName2, `/ipns/${record.publicKey.toCID().toString(base36)}`, {
      offline: true
    })

    expect(recursiveRecord.record.value).to.equal(`/ipns/${record.publicKey.toCID().toString(base36)}`)

    const recursiveResult = await name.resolve(recursiveRecord.publicKey)
    expect(recursiveResult.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should publish record with a path', async () => {
    const path = '/foo/bar/baz'
    const fullPath = `/ipfs/${cid}/${path}`

    const keyName = 'test-key-12'
    const record = await name.publish(keyName, fullPath, {
      offline: true
    })

    expect(record.record.value).to.equal(fullPath)

    const result = await name.resolve(record.publicKey)

    expect(result.cid.toString()).to.equal(cid.toString())
    expect(result.path).to.equal(path)
  })

  describe('localStore error handling', () => {
    it('should handle datastore errors during publish', async () => {
      await start(name)

      // Stub localStore.get to throw an error
      const store = localStore(result.datastore, result.log)
      const getStub = Sinon.stub(store, 'get').rejects(new Error('Datastore get failed'))
      const hasStub = Sinon.stub(store, 'has').resolves(true)

      // Override the localStore on the IPNS instance
      // @ts-ignore
      name.localStore = store

      const keyName = 'test-key-error'
      await expect(name.publish(keyName, cid)).to.be.rejectedWith('Datastore get failed')

      expect(hasStub.called).to.be.true()
      expect(getStub.called).to.be.true()
    })

    it('should handle datastore put errors during publish', async () => {
      await start(name)

      // Stub datastore.put to throw an error
      const putStub = Sinon.stub(result.datastore, 'put').rejects(new Error('Datastore put failed'))
      const hasStub = Sinon.stub(result.datastore, 'has').resolves(false)

      const keyName = 'test-key-put-error'
      await expect(name.publish(keyName, cid)).to.be.rejectedWith('Datastore put failed')

      expect(hasStub.called).to.be.true()
      expect(putStub.called).to.be.true()
    })

    it('should emit error progress events when localStore fails', async () => {
      await start(name)

      const progressEvents: any[] = []

      const putStub = Sinon.stub(result.datastore, 'get').rejects(new Error('Storage error'))
      const hasStub = Sinon.stub(result.datastore, 'has').resolves(false)

      const keyName = 'test-key-progress-error'

      await expect(name.publish(keyName, cid, {
        onProgress: (evt) => progressEvents.push(evt)
      })).to.be.rejectedWith('Storage error')

      expect(hasStub.called).to.be.true()
      expect(putStub.called).to.be.true()

      // Check if error progress event was emitted by localStore
      const errorEvent = progressEvents.find(evt => evt.type === 'ipns:routing:datastore:error')
      expect(errorEvent).to.exist()
      expect(errorEvent.detail.message).to.equal('Storage error')
    })

    it('should handle network timeouts in localStore', async () => {
      await start(name)

      // Create a timeout error
      const timeoutError = new Error('Network timeout')
      timeoutError.name = 'TimeoutError'

      const hasStub = Sinon.stub(result.datastore, 'has').rejects(timeoutError)

      const keyName = 'test-key-timeout'
      await expect(name.publish(keyName, cid)).to.be.rejectedWith('Network timeout')

      expect(hasStub.called).to.be.true()
    })
  })
})
