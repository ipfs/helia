/* eslint-env mocha */

import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Libp2pRecord } from '@libp2p/record'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { type Datastore, Key } from 'interface-datastore'
import { create, marshal, peerIdToRoutingKey } from 'ipns'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('resolve', () => {
  let name: IPNS
  let routing: StubbedInstance<IPNSRouting>
  let datastore: Datastore

  beforeEach(async () => {
    datastore = new MemoryDatastore()
    routing = stubInterface<IPNSRouting>()
    routing.get.throws(new Error('Not found'))

    name = ipns({ datastore }, [routing])
  })

  it('should resolve a record', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    const resolvedValue = await name.resolve(key)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve a record offline', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    expect(routing.put.called).to.be.true()

    const resolvedValue = await name.resolve(key, {
      offline: true
    })

    expect(routing.get.called).to.be.false()

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve a recursive record', async () => {
    const key1 = await createEd25519PeerId()
    const key2 = await createEd25519PeerId()
    await name.publish(key2, cid)
    await name.publish(key1, key2)

    const resolvedValue = await name.resolve(key1)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve /ipns/tableflip.io', async function () {
    const domain = 'tableflip.io'

    try {
      const resolvedValue = await name.resolveDns(domain)

      expect(resolvedValue).to.be.an.instanceOf(CID)
    } catch (err: any) {
      // happens when running tests offline
      if (err.message.includes(`ECONNREFUSED ${domain}`) === true) {
        return this.skip()
      }

      throw err
    }
  })

  it('should emit progress events', async function () {
    const onProgress = Sinon.stub()
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    await name.resolve(key, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })

  it('should cache a record', async function () {
    const peerId = await createEd25519PeerId()
    const routingKey = peerIdToRoutingKey(peerId)
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(routingKey, 'base32'), false)

    expect(datastore.has(dhtKey)).to.be.false('already had record')

    const record = await create(peerId, cid, 0n, 60000)
    const marshalledRecord = marshal(record)

    routing.get.withArgs(routingKey).resolves(marshalledRecord)

    const result = await name.resolve(peerId)
    expect(result.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    expect(datastore.has(dhtKey)).to.be.true('did not cache record locally')
  })

  it('should cache the most recent record', async function () {
    const peerId = await createEd25519PeerId()
    const routingKey = peerIdToRoutingKey(peerId)
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(routingKey, 'base32'), false)

    const marshalledRecordA = marshal(await create(peerId, cid, 0n, 60000))
    const marshalledRecordB = marshal(await create(peerId, cid, 10n, 60000))

    // records should not match
    expect(marshalledRecordA).to.not.equalBytes(marshalledRecordB)

    // cache has older record
    await datastore.put(dhtKey, marshalledRecordA)
    routing.get.withArgs(routingKey).resolves(marshalledRecordB)

    const result = await name.resolve(peerId)
    expect(result.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    const cached = await datastore.get(dhtKey)
    const record = Libp2pRecord.deserialize(cached)

    // should have cached the updated record
    expect(record.value).to.equalBytes(marshalledRecordB)
  })
})
