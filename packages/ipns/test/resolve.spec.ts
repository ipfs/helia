/* eslint-env mocha */

import { Record } from '@libp2p/kad-dht'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryDatastore } from 'datastore-core'
import { Key } from 'interface-datastore'
import { createIPNSRecord, createIPNSRecordWithExpiration, marshalIPNSRecord, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { keychain } from '@libp2p/keychain'
import { ipns } from '../src/index.js'
import type { IPNS, IPNSRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { DNS } from '@multiformats/dns'
import type { Datastore } from 'interface-datastore'
import type { StubbedInstance } from 'sinon-ts'
import type { Keychain, KeychainInit } from '@libp2p/keychain'
import { generateKeyPair } from '@libp2p/crypto/keys'

const cid = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')

describe('resolve', () => {
  let name: IPNS
  let customRouting: StubbedInstance<IPNSRouting>
  let datastore: Datastore
  let heliaRouting: StubbedInstance<Routing>
  let dns: StubbedInstance<DNS>
  let ipnsKeychain: Keychain

  beforeEach(async () => {
    datastore = new MemoryDatastore()
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

  it('should resolve a record', async () => {
    const keyName = 'test-key'
    const { record, publicKey } = await name.publish(keyName, cid)

    // empty the datastore to ensure we resolve using the routing
    await drain(datastore.deleteMany(datastore.queryKeys({})))

    heliaRouting.get.resolves(marshalIPNSRecord(record))

    const resolvedValue = await name.resolve(publicKey)
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())

    expect(heliaRouting.get.called).to.be.true()
    expect(customRouting.get.called).to.be.true()
  })

  it('should resolve a record offline', async () => {
    const keyName = 'test-key'
    const { publicKey } = await name.publish(keyName, cid)

    expect(heliaRouting.put.called).to.be.true()
    expect(customRouting.put.called).to.be.true()

    const resolvedValue = await name.resolve(publicKey, {
      offline: true
    })
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())

    expect(heliaRouting.get.called).to.be.false()
    expect(customRouting.get.called).to.be.false()
  })

  it('should skip the local cache when resolving a record', async () => {
    const cachePutSpy = Sinon.spy(datastore, 'put')
    const cacheGetSpy = Sinon.spy(datastore, 'get')

    const keyName = 'test-key'
    const { record, publicKey } = await name.publish(keyName, cid)

    heliaRouting.get.resolves(marshalIPNSRecord(record))

    const resolvedValue = await name.resolve(publicKey, {
      nocache: true
    })
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())

    expect(heliaRouting.get.called).to.be.true()
    expect(customRouting.get.called).to.be.true()

    // we call `.get` during `.put`
    cachePutSpy.calledBefore(cacheGetSpy)
  })

  it('should retrieve from local cache when resolving a record', async () => {
    const cacheGetSpy = Sinon.spy(datastore, 'get')

    const keyName = 'test-key'
    const { publicKey } = await name.publish(keyName, cid)

    const resolvedValue = await name.resolve(publicKey)
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())

    expect(heliaRouting.get.called).to.be.false()
    expect(customRouting.get.called).to.be.false()
    expect(cacheGetSpy.called).to.be.true()
  })

  it('should resolve a recursive record', async () => {
    const keyName1 = 'key1'
    const keyName2 = 'key2'

    const { publicKey: publicKey2 } = await name.publish(keyName2, cid)
    const { publicKey: publicKey1 } = await name.publish(keyName1, publicKey2)

    const resolvedValue = await name.resolve(publicKey1)
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should resolve a recursive record with path', async () => {
    const keyName1 = 'key1'
    const keyName2 = 'key2'

    const { publicKey: publicKey2 } = await name.publish(keyName2, cid)
    const { publicKey: publicKey1 } = await name.publish(keyName1, publicKey2)

    const resolvedValue = await name.resolve(publicKey1)
    expect(resolvedValue.cid.toString()).to.equal(cid.toV1().toString())
  })

  it('should emit progress events', async function () {
    const onProgress = Sinon.stub()
    const keyName = 'test-key'
    const { publicKey } = await name.publish(keyName, cid)

    await name.resolve(publicKey, {
      onProgress
    })

    expect(onProgress).to.have.property('called', true)
  })

  it('should cache a record', async function () {
    const key = await generateKeyPair('Ed25519')
    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    expect(datastore.has(dhtKey)).to.be.false('already had record')

    const record = await createIPNSRecord(key, cid, 0n, 60000)
    const marshalledRecord = marshalIPNSRecord(record)

    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecord)

    const result = await name.resolve(key.publicKey)
    expect(result.cid.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    expect(datastore.has(dhtKey)).to.be.true('did not cache record locally')
  })

  it('should cache the most recent record', async function () {
    const key = await generateKeyPair('Ed25519')
    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    const marshalledRecordA = marshalIPNSRecord(await createIPNSRecord(key, cid, 0n, 60000))
    const marshalledRecordB = marshalIPNSRecord(await createIPNSRecord(key, cid, 10n, 60000))

    // records should not match
    expect(marshalledRecordA).to.not.equalBytes(marshalledRecordB)

    // cache has older record
    await datastore.put(dhtKey, marshalledRecordA)
    customRouting.get.withArgs(customRoutingKey).resolves(marshalledRecordB)

    const result = await name.resolve(key.publicKey)
    expect(result.cid.toString()).to.equal(cid.toV1().toString(), 'incorrect record resolved')

    const cached = await datastore.get(dhtKey)
    const record = Record.deserialize(cached)

    // should have cached the updated record
    expect(record.value).to.equalBytes(marshalledRecordB)
  })

  it('should include IPNS record in result', async () => {
    const keyName = 'test-key'
    const { record, publicKey } = await name.publish(keyName, cid)

    const result = await name.resolve(publicKey)

    expect(result).to.have.deep.property('record')
    expect(marshalIPNSRecord(result.record)).to.deep.equal(marshalIPNSRecord(record))
  })

  it('should not search the routing for updated IPNS records when a locally cached copy is within the TTL', async () => {
    const key = await generateKeyPair('Ed25519')
    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    // create a record with a valid lifetime and a non-expired TTL
    const ipnsRecord = await createIPNSRecord(key, cid, 1, Math.pow(2, 10), {
      ttlNs: 10_000_000_000
    })
    const dhtRecord = new Record(customRoutingKey, marshalIPNSRecord(ipnsRecord), new Date(Date.now()))

    await datastore.put(dhtKey, dhtRecord.serialize())

    const result = await name.resolve(key.publicKey)
    expect(result).to.have.deep.property('record', unmarshalIPNSRecord(marshalIPNSRecord(ipnsRecord)))

    // should not have searched the routing
    expect(customRouting.get.called).to.be.false()
  })

  it('should search the routing for updated IPNS records when a locally cached copy has passed the TTL', async () => {
    const key = await generateKeyPair('Ed25519')

    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    // create a record with a valid lifetime but an expired ttl
    const ipnsRecord = await createIPNSRecord(key, cid, 1, Math.pow(2, 10), {
      ttlNs: 10
    })
    const dhtRecord = new Record(customRoutingKey, marshalIPNSRecord(ipnsRecord), new Date(Date.now() - 1000))

    await datastore.put(dhtKey, dhtRecord.serialize())

    const result = await name.resolve(key.publicKey)
    expect(result).to.have.deep.property('record', unmarshalIPNSRecord(marshalIPNSRecord(ipnsRecord)))

    // should have searched the routing
    expect(customRouting.get.called).to.be.true()
  })

  it('should search the routing for updated IPNS records when a locally cached copy has passed the TTL and choose the record with a higher sequence number', async () => {
    const key = await generateKeyPair('Ed25519')

    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    // create a record with a valid lifetime but an expired ttl
    const ipnsRecord = await createIPNSRecord(key, cid, 10, Math.pow(2, 10), {
      ttlNs: 10
    })
    const dhtRecord = new Record(customRoutingKey, marshalIPNSRecord(ipnsRecord), new Date(Date.now() - 1000))

    await datastore.put(dhtKey, dhtRecord.serialize())

    // the routing returns a valid record with an higher sequence number
    const ipnsRecordFromRouting = await createIPNSRecord(key, cid, 11, Math.pow(2, 10), {
      ttlNs: 10_000_000
    })
    customRouting.get.withArgs(customRoutingKey).resolves(marshalIPNSRecord(ipnsRecordFromRouting))

    const result = await name.resolve(key.publicKey)
    expect(result).to.have.deep.property('record', unmarshalIPNSRecord(marshalIPNSRecord(ipnsRecordFromRouting)))

    // should have searched the routing
    expect(customRouting.get.called).to.be.true()
  })

  it('should search the routing when a locally cached copy has an expired lifetime', async () => {
    const key = await generateKeyPair('Ed25519')

    const customRoutingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())
    const dhtKey = new Key('/dht/record/' + uint8ArrayToString(customRoutingKey, 'base32'), false)

    // create a record with an expired lifetime but valid TTL
    const ipnsRecord = await createIPNSRecordWithExpiration(key, cid, 10, new Date(Date.now() - Math.pow(2, 10)).toString(), {
      ttlNs: 10_000_000
    })
    const dhtRecord = new Record(customRoutingKey, marshalIPNSRecord(ipnsRecord), new Date(Date.now()))

    await datastore.put(dhtKey, dhtRecord.serialize())

    // the routing returns a valid record with an higher sequence number
    const ipnsRecordFromRouting = await createIPNSRecord(key, cid, 11, Math.pow(2, 10), {
      ttlNs: 10_000_000
    })
    customRouting.get.withArgs(customRoutingKey).resolves(marshalIPNSRecord(ipnsRecordFromRouting))

    const result = await name.resolve(key.publicKey)
    expect(result).to.have.deep.property('record', unmarshalIPNSRecord(marshalIPNSRecord(ipnsRecordFromRouting)))

    // should have searched the routing
    expect(customRouting.get.called).to.be.true()
  })
})
