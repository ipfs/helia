/* eslint-env mocha */

import { Record } from '@libp2p/kad-dht'
import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
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
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('resolve', () => {
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let datastore: Datastore
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>

  beforeEach(async () => {
    datastore = new MemoryDatastore()
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

  it('should resolve a record', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    const resolvedValue = await name.resolve(key)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())

    expect(heliaRouting.get.called).to.be.true()
    expect(customRouting.get.called).to.be.true()
  })

  it('should resolve a record offline', async () => {
    const key = await createEd25519PeerId()
    await name.publish(key, cid)

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()

    const resolvedValue = await name.resolve(key, {
      offline: true
    })

    expect(heliaRouting.get.called).to.be.false()
    expect(customRouting.get.called).to.be.false()

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())
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

    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve a recursive record with path', async () => {
    const key1 = await createEd25519PeerId()
    const key2 = await createEd25519PeerId()
    await name.publish(key2, cid)
    await name.publish(key1, key2)

    const resolvedValue = await name.resolve(key1)

    if (resolvedValue == null) {
      throw new Error('Did not resolve entry')
    }

    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())
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
    const customRoutingKey = peerIdToRoutingKey(peerId)
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    expect(datastore.has(dhtKey)).to.be.false('already had record')

    const record = await create(peerId, cid, 0n, 60000)
    const marshalledRecord = marshal(record)

    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecord)

    const result = await name.resolve(peerId)
    expect(result.cid.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    expect(datastore.has(dhtKey)).to.be.true('did not cache record locally')
  })

  it('should cache the most recent record', async function () {
    const peerId = await createEd25519PeerId()
    const customRoutingKey = peerIdToRoutingKey(peerId)
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    const marshalledRecordA = marshal(await create(peerId, cid, 0n, 60000))
    const marshalledRecordB = marshal(await create(peerId, cid, 10n, 60000))

    // records should not match
    expect(marshalledRecordA).to.not.equalBytes(marshalledRecordB)

    // cache has older record
    await datastore.put(dhtKey, marshalledRecordA)
    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecordB)

    const result = await name.resolve(peerId)
    expect(result.cid.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    const cached = await datastore.get(dhtKey)
    const record = Record.deserialize(cached)

    // should have cached the updated record
    expect(record.value).to.equalBytes(marshalledRecordB)
  })
})
