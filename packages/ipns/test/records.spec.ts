import { ed25519Crypto, Keychain, rsaCrypto } from '@helia/utils'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import * as cbor from 'cborg'
import { MemoryDatastore } from 'datastore-core'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { InvalidEmbeddedPublicKeyError, RecordExpiredError, SignatureVerificationError } from '../src/errors.ts'
import { IpnsEntry } from '../src/pb/ipns.ts'
import { createIPNSRecord, createIPNSRecordWithExpiration } from '../src/records.ts'
import { parseCborData, createCborData, ipnsRecordDataForV2Sig, marshalIPNSRecord, unmarshalIPNSRecord, multihashToIPNSRoutingKey, multihashFromIPNSRoutingKey, normalizeValue } from '../src/utils.ts'
import { ipnsValidator } from '../src/validator.ts'
import { getCryptoKey } from './fixtures/crypto-loader.ts'
import { kuboRecord } from './fixtures/records.ts'
import type { PrivateKey } from '@helia/interface'

describe('records', function () {
  this.timeout(20 * 1000)

  const contentPath = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
  let privateKey: PrivateKey
  let keychain: Keychain

  before(async () => {
    const crypto = rsaCrypto()
    privateKey = await crypto.createPrivateKey()
    keychain = new Keychain({
      datastore: new MemoryDatastore(),
      logger: defaultLogger(),
      getCryptoKey
    })
  })

  it('should create an ipns record (V1+V2) correctly', async () => {
    const sequence = 0
    const ttl = BigInt(5 * 60 * 1e+9)
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    expect(record.value).to.equal(contentPath)
    expect(record.validityType).to.equal(IpnsEntry.ValidityType.EOL)
    expect(record.validity).to.exist()
    expect(record.sequence).to.equal(BigInt(0))
    expect(record.ttl).to.equal(ttl)
    expect(record.signatureV1).to.exist()
    expect(record.signatureV2).to.exist()
    expect(record.data).to.exist()

    // Protobuf must have all fields!
    const pb = IpnsEntry.decode(marshalIPNSRecord(record))
    expect(pb.value).to.equalBytes(uint8ArrayFromString(contentPath))
    expect(pb.validityType).to.equal(IpnsEntry.ValidityType.EOL)
    expect(pb.validity).to.exist()
    expect(pb.sequence).to.equal(BigInt(sequence))
    expect(pb.ttl).to.equal(ttl)
    expect(pb.signatureV1).to.exist()
    expect(pb.signatureV2).to.exist()
    expect(pb.data).to.exist()

    // Protobuf.Data must have all fields and match!
    const data = parseCborData(pb.data ?? new Uint8Array(0))
    expect(data.Value).to.equalBytes(pb.value)
    expect(data.ValidityType).to.equal(pb.validityType)
    expect(data.Validity).to.equalBytes(pb.validity)
    expect(data.Sequence).to.equal(pb.sequence)
    expect(data.TTL).to.equal(pb.ttl)
  })

  it('should create an ipns record (V2) correctly', async () => {
    const sequence = 0
    const ttl = BigInt(5 * 60 * 1e+9)
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, { v1Compatible: false })

    expect(record.value).to.equal(contentPath)
    expect(record.validityType).to.equal(IpnsEntry.ValidityType.EOL)
    expect(record.validity).to.exist()
    expect(record.sequence).to.equal(BigInt(0))
    expect(record.ttl).to.equal(ttl)
    expect(record.signatureV2).to.exist()
    expect(record).to.not.have.property('signatureV1')
    expect(record.data).to.exist()

    // PB must only have signature and data.
    const pb = IpnsEntry.decode(marshalIPNSRecord(record))
    expect(pb.value).to.not.exist()
    expect(pb.validityType).to.not.exist()
    expect(pb.validity).to.not.exist()
    expect(pb.sequence).to.not.exist()
    expect(pb.ttl).to.not.exist()
    expect(pb.signatureV1).to.not.exist()
    expect(pb.signatureV2).to.exist()
    expect(pb.data).to.exist()

    // Protobuf.Data must have all fields and match!
    const data = parseCborData(pb.data ?? new Uint8Array(0))
    expect(data.Value).to.equalBytes(uint8ArrayFromString(contentPath))
    expect(data.ValidityType).to.equal(IpnsEntry.ValidityType.EOL)
    expect(data.Validity).to.exist()
    expect(data.Sequence).to.equal(BigInt(sequence))
    expect(data.TTL).to.equal(ttl)
  })

  it('should be able to create a record (V1+V2) with a fixed expiration', async () => {
    const sequence = 0
    const expiration = '2033-05-18T03:33:20.000000000Z'

    const record = await createIPNSRecordWithExpiration(privateKey, contentPath, sequence, expiration)
    await ipnsValidator(record)

    const marshalledRecord = marshalIPNSRecord(record)
    const pb = IpnsEntry.decode(marshalledRecord)
    expect(pb).to.have.property('validity')
    expect(pb.validity).to.equalBytes(uint8ArrayFromString(expiration))
  })

  it('should be able to create a record (V2) with a fixed expiration', async () => {
    const sequence = 0
    const expiration = '2033-05-18T03:33:20.000000000Z'

    const record = await createIPNSRecordWithExpiration(privateKey, contentPath, sequence, expiration, { v1Compatible: false })
    await ipnsValidator(record)

    const marshalledRecord = marshalIPNSRecord(record)
    const pb = IpnsEntry.decode(marshalledRecord)
    expect(pb).to.not.have.property('validity')

    const data = parseCborData(pb.data ?? new Uint8Array(0))
    expect(data.Validity).to.equalBytes(uint8ArrayFromString(expiration))
  })

  it('should be able to create a record (V1+V2) with a fixed ttl', async () => {
    const sequence = 0
    const ttl = BigInt(0.6e+12)
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      ttlNs: ttl
    })
    await ipnsValidator(record)

    const marshalledRecord = marshalIPNSRecord(record)
    const pb = IpnsEntry.decode(marshalledRecord)
    const data = parseCborData(pb.data ?? new Uint8Array(0))
    expect(data.TTL).to.equal(ttl)
  })

  it('should be able to create a record (V2) with a fixed ttl', async () => {
    const sequence = 0
    const ttl = BigInt(1.6e+12)
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      ttlNs: ttl,
      v1Compatible: false
    })
    await ipnsValidator(record)

    const marshalledRecord = marshalIPNSRecord(record)
    const pb = IpnsEntry.decode(marshalledRecord)
    expect(pb).to.not.have.property('ttl')

    const data = parseCborData(pb.data ?? new Uint8Array(0))
    expect(data.TTL).to.equal(ttl)
  })

  it('should create an ipns record (V1+V2) and validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    await ipnsValidator(record)
  })

  it('should create an ipns record (V2) and validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, { v1Compatible: false })
    await ipnsValidator(record)
  })

  it('should normalize value when creating an ipns record (arbitrary string path)', async () => {
    const inputValue = normalizeValue('/foo/bar/baz')
    const expectedValue = '/foo/bar/baz'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when creating a recursive ipns record (Ed25519 public key)', async () => {
    const crypto = ed25519Crypto()
    const otherKey = await crypto.createPrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey)
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when creating a recursive ipns record (RSA public key)', async () => {
    const crypto = rsaCrypto()
    const otherKey = await crypto.createPrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey)
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when creating a recursive ipns record (public key as CID)', async () => {
    const crypto = ed25519Crypto()
    const otherKey = await crypto.createPrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey.toCID())
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when creating an ipns record (v0 cid)', async () => {
    const cid = CID.parse('QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq')
    const inputValue = normalizeValue(cid)
    const expectedValue = `/ipfs/${cid.toV1()}`
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when creating an ipns record (v1 cid)', async () => {
    const inputValue = normalizeValue(CID.parse('bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'))
    const expectedValue = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)
    expect(record.value).to.equal(expectedValue)
  })

  it('should normalize value when reading an ipns record (string v0 cid path)', async () => {
    const cid = CID.parse('QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq')
    const inputValue = normalizeValue(`/ipfs/${cid}`)
    const expectedValue = `/ipfs/${cid.toV1()}`
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    const pb = IpnsEntry.decode(marshalIPNSRecord(record))
    pb.data = createCborData(inputValue, pb.validityType ?? IpnsEntry.ValidityType.EOL, pb.validity ?? new Uint8Array(0), pb.sequence ?? 0n, pb.ttl ?? 0n)
    pb.value = uint8ArrayFromString(inputValue)

    const modifiedRecord = await unmarshalIPNSRecord(routingKey, IpnsEntry.encode(pb), keychain)
    expect(modifiedRecord.value).to.equal(expectedValue)
  })

  it('should normalize value when reading an ipns record (string v1 cid path)', async () => {
    const inputValue = normalizeValue('/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu')
    const expectedValue = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    const pb = IpnsEntry.decode(marshalIPNSRecord(record))
    pb.data = createCborData(inputValue, pb.validityType ?? IpnsEntry.ValidityType.EOL, pb.validity ?? new Uint8Array(0), pb.sequence ?? 0n, pb.ttl ?? 0n)
    pb.value = uint8ArrayFromString(inputValue)

    const modifiedRecord = await unmarshalIPNSRecord(routingKey, IpnsEntry.encode(pb), keychain)
    expect(modifiedRecord.value).to.equal(expectedValue)
  })

  it('should fail to validate a v1 (deprecated legacy) message', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    const pb = IpnsEntry.decode(marshalIPNSRecord(record))

    // remove the extra fields added for v2 sigs
    // @ts-expect-error data is not optional
    delete record.data
    // @ts-expect-error signatureV2 is not optional
    delete record.signatureV2

    // confirm a v1 exists
    expect(pb).to.have.property('signatureV1')

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should fail to validate a v2 without v2 signature (ignore v1)', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    const pb = IpnsEntry.decode(marshalIPNSRecord(record))

    // remove v2 sig
    // @ts-expect-error signatureV2 is not optional
    delete record.signatureV2

    // confirm a v1 exists
    expect(pb).to.have.property('signatureV1')

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should fail to validate a bad record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    // corrupt the record by changing the value to random bytes
    const data = cbor.decode(record.data)
    data.value = crypto.getRandomValues(new Uint8Array(46))
    record.data = cbor.encode(data)

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should create an ipns record with a validity of 1 nanosecond correctly and it should not be valid 1ms later', async () => {
    const sequence = 0
    const validity = 0.00001

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    await new Promise(resolve => setTimeout(resolve, 1))

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', RecordExpiredError.name)
  })

  it('should create an ipns record, marshal and unmarshal it, as well as validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const createdRecord = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    const marshaledData = marshalIPNSRecord(createdRecord)
    const unmarshaledData = await unmarshalIPNSRecord(routingKey, marshaledData, keychain)

    expect(createdRecord.value).to.equal(unmarshaledData.value)
    expect(createdRecord.validity.toString()).to.equal(unmarshaledData.validity.toString())
    expect(createdRecord.validityType).to.equal(unmarshaledData.validityType)
    expect(createdRecord.signatureV1).to.equalBytes('signatureV1' in unmarshaledData ? unmarshaledData.signatureV1 : new Uint8Array(0))
    expect(createdRecord.sequence).to.equal(unmarshaledData.sequence)
    expect(createdRecord.ttl).to.equal(unmarshaledData.ttl)
    expect(createdRecord.signatureV2).to.equalBytes(unmarshaledData.signatureV2)
    expect(createdRecord.data).to.equalBytes(unmarshaledData.data)

    await ipnsValidator(createdRecord)
  })

  it('should be able to turn routing key back into id', () => {
    const keys = [
      'QmQd5Enz5tzP8u5wHur8ADuJMbcNhEf86CkWkqRzoWUhst',
      'QmW6mcoqDKJRch2oph2FmvZhPLJn6wPU648Vv9iMyMtmtG'
    ]

    keys.forEach(key => {
      const digest = Digest.decode(base58btc.decode(`z${key}`))
      const routingKey = multihashToIPNSRoutingKey(digest)
      const id = multihashFromIPNSRoutingKey(routingKey)

      expect(base58btc.encode(id.bytes)).to.equal(`z${key}`)
    })
  })

  it('should be able to embed a public key in an ipns record', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    expect(record.publicKey).to.deep.equal(privateKey.publicKey)

    const pb = IpnsEntry.decode(marshalIPNSRecord(record))
    expect(pb.publicKey).to.equalBytes(privateKey.publicKey.toProtobuf())
  })

  // It should have a public key embedded for newer ed25519 keys
  // https://github.com/ipfs/go-ipns/blob/d51115b4b14ed7fcca5472aadff0fee6772aca8c/ipns.go#L81
  // https://github.com/ipfs/go-ipns/blob/d51115b4b14ed7fcca5472aadff0fee6772aca8c/ipns_test.go
  // https://github.com/libp2p/go-libp2p-peer/blob/7f219a1e70011a258c5d3e502aef6896c60d03ce/peer.go#L80
  // IDFromEd25519PublicKey is not currently implement on js-libp2p-peer
  // https://github.com/libp2p/go-libp2p-peer/pull/30
  it('should be able to extract a public key directly from the peer', async () => {
    const sequence = 0
    const validity = 1000000

    const crypto = ed25519Crypto()
    const privateKey = await crypto.createPrivateKey()
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    expect(record).to.not.have.property('pubKey') // ed25519 keys should not be embedded
  })

  it('validator with no valid public key should error', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    // @ts-expect-error publicKey is not optional
    delete record.publicKey

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', InvalidEmbeddedPublicKeyError.name)
  })

  it('should be able to export a previously embedded public key from an ipns record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    expect(record.publicKey).to.deep.equal(privateKey.publicKey)
  })

  it('should unmarshal a record with raw CID bytes', async () => {
    // we may encounter these in the wild due to older versions of this module
    // but IPNS records should have string path values

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    // create a dummy record with an arbitrary string path
    const input = await createIPNSRecord(privateKey, normalizeValue('/foo'), 0n, 10000, {
      v1Compatible: false
    })

    // we will store the raw bytes from this CID
    const cid = CID.parse('bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu')

    // override data with raw CID bytes
    const data = cbor.decode(input.data)
    data.Value = cid.bytes
    input.data = cbor.encode(data)

    // re-sign record
    const sigData = ipnsRecordDataForV2Sig(input.data)
    input.signatureV2 = await privateKey.sign(sigData)

    const buf = marshalIPNSRecord(input)
    const record = await unmarshalIPNSRecord(routingKey, buf, keychain)

    expect(record).to.have.property('value').that.equals('/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu')
  })

  it('should round trip kubo records to bytes and back', async () => {
    const crypto = ed25519Crypto()
    const privateKey = await crypto.createPrivateKey()
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    // the IPNS spec gives an example for the Validity field as
    // 1970-01-01T00:00:00.000000001Z - e.g. nanosecond precision but Kubo only
    // uses microsecond precision. The value is a timestamp as defined by
    // rfc3339 which doesn't have a strong opinion on fractions of seconds so
    // both are valid but we must be able to round trip them intact.
    const unmarshaled = await unmarshalIPNSRecord(routingKey, kuboRecord.bytes, keychain)
    const reMarshaled = marshalIPNSRecord(unmarshaled)

    const reUnmarshaled = await unmarshalIPNSRecord(routingKey, reMarshaled, keychain)

    expect(unmarshaled).to.deep.equal(reUnmarshaled)
    expect(reMarshaled).to.equalBytes(kuboRecord.bytes)
  })
})
