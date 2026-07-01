import { ed25519Crypto, rsaCrypto } from '@ipshipyard/crypto'
import { keychain } from '@ipshipyard/keychain'
import { expect } from 'aegir/chai'
import * as cbor from 'cborg'
import { MemoryDatastore } from 'datastore-core'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { withArrayBuffer } from 'uint8arrays/with-array-buffer'
import { InvalidEmbeddedPublicKeyError, RecordExpiredError, SignatureVerificationError } from '../src/errors.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { createIPNSRecord } from '../src/records.ts'
import { ipnsRecordDataForV2Sig, multihashToIPNSRoutingKey, multihashFromIPNSRoutingKey, normalizeValue, decodeExtensibleData, encodeExtensibleData } from '../src/utils.ts'
import { ipnsValidator } from '../src/validator.ts'
import { getCrypto } from './fixtures/get-crypto.ts'
import { kuboRecord } from './fixtures/records.ts'
import type { Keychain, PrivateKey } from '@helia/interface'

describe('records', function () {
  this.timeout(20 * 1000)

  const contentPath = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
  let privateKey: PrivateKey
  let kc: Keychain

  before(async () => {
    const crypto = rsaCrypto()
    privateKey = await crypto.generatePrivateKey()
    kc = keychain()({
      datastore: new MemoryDatastore(),
      getCrypto
    })
  })

  it('should create an ipns record (V1+V2) correctly', async () => {
    const sequence = 0
    const ttl = BigInt(5 * 60 * 1e+9)
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      v1Compatible: true
    })

    expect(record.value).to.equalBytes(uint8ArrayFromString(contentPath))
    expect(record.validityType).to.equal(IPNSEntry.ValidityType.EOL)
    expect(record.validity).to.exist()
    expect(record.sequence).to.equal(BigInt(0))
    expect(record.ttl).to.equal(ttl)
    expect(record.signatureV1).to.exist()
    expect(record.signatureV2).to.exist()
    expect(record.data).to.exist()

    // Protobuf must have all fields!
    const pb = IPNSEntry.decode(IPNSEntry.encode(record))
    expect(pb.value).to.equalBytes(uint8ArrayFromString(contentPath))
    expect(pb.validityType).to.equal(IPNSEntry.ValidityType.EOL)
    expect(pb.validity).to.exist()
    expect(pb.sequence).to.equal(BigInt(sequence))
    expect(pb.ttl).to.equal(ttl)
    expect(pb.signatureV1).to.exist()
    expect(pb.signatureV2).to.exist()
    expect(pb.data).to.exist()

    // Protobuf.Data must have all fields and match!
    const data = decodeExtensibleData(pb.data ?? new Uint8Array(0))
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
    expect(record.value).to.not.exist()
    expect(record.validityType).to.not.exist()
    expect(record.validity).to.not.exist()
    expect(record.sequence).to.not.exist()
    expect(record.ttl).to.not.exist()
    expect(record.signatureV1).to.not.exist()
    expect(record.signatureV2).to.exist()
    expect(record.data).to.exist()

    // PB must only have signature and data.
    const pb = IPNSEntry.decode(IPNSEntry.encode(record))
    expect(pb.value).to.not.exist()
    expect(pb.validityType).to.not.exist()
    expect(pb.validity).to.not.exist()
    expect(pb.sequence).to.not.exist()
    expect(pb.ttl).to.not.exist()
    expect(pb.signatureV1).to.not.exist()
    expect(pb.signatureV2).to.exist()
    expect(pb.data).to.exist()

    // Protobuf.Data must have all fields and match!
    const data = decodeExtensibleData(pb.data ?? new Uint8Array(0))
    expect(data.Value).to.equalBytes(uint8ArrayFromString(contentPath))
    expect(data.ValidityType).to.equal(IPNSEntry.ValidityType.EOL)
    expect(data.Validity).to.exist()
    expect(data.Sequence).to.equal(BigInt(sequence))
    expect(data.TTL).to.equal(ttl)
  })

  it('should be able to create a record (V1+V2) with a fixed ttl', async () => {
    const sequence = 0
    const ttlNs = 1_600_000_000_000n
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      ttlNs
    })

    const marshalledRecord = IPNSEntry.encode(record)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    await ipnsValidator(routingKey, marshalledRecord, kc)

    const pb = IPNSEntry.decode(marshalledRecord)
    const data = decodeExtensibleData(pb.data ?? new Uint8Array(0))
    expect(data.TTL).to.equal(ttlNs)
  })

  it('should be able to create a record (V2) with a fixed ttl', async () => {
    const sequence = 0
    const ttlNs = 1_600_000_000_000n
    const validity = 1_000_000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      ttlNs,
      v1Compatible: false
    })
    const marshalledRecord = IPNSEntry.encode(record)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    await ipnsValidator(routingKey, marshalledRecord, kc)

    const pb = IPNSEntry.decode(marshalledRecord)
    expect(pb).to.not.have.property('ttl')

    const data = decodeExtensibleData(pb.data ?? new Uint8Array(0))
    expect(data.TTL).to.equal(ttlNs)
  })

  it('should create an ipns record (V1+V2) and validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    const marshalledRecord = IPNSEntry.encode(record)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    await ipnsValidator(routingKey, marshalledRecord, kc)
  })

  it('should create an ipns record (V2) and validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, { v1Compatible: false })

    const marshalledRecord = IPNSEntry.encode(record)
    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    await ipnsValidator(routingKey, marshalledRecord, kc)
  })

  it('should normalize value when creating an ipns record (arbitrary string path)', async () => {
    const inputValue = normalizeValue('/foo/bar/baz')
    const expectedValue = '/foo/bar/baz'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when creating a recursive ipns record (Ed25519 public key)', async () => {
    const crypto = ed25519Crypto()
    const otherKey = await crypto.generatePrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey)
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when creating a recursive ipns record (RSA public key)', async () => {
    const crypto = rsaCrypto()
    const otherKey = await crypto.generatePrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey)
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when creating a recursive ipns record (public key as CID)', async () => {
    const crypto = ed25519Crypto()
    const otherKey = await crypto.generatePrivateKey()
    const expectedValue = normalizeValue(otherKey.publicKey.toCID())
    const record = await createIPNSRecord(privateKey, expectedValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when creating an ipns record (v0 cid)', async () => {
    const cid = CID.parse('QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq')
    const inputValue = normalizeValue(cid)
    const expectedValue = `/ipfs/${cid.toV1()}`
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when creating an ipns record (v1 cid)', async () => {
    const inputValue = normalizeValue(CID.parse('bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'))
    const expectedValue = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)

    const extensibleData = decodeExtensibleData(record.data)
    expect(extensibleData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when reading an ipns record (string v0 cid path)', async () => {
    const cid = CID.parse('QmWEekX7EZLUd9VXRNMRXW3LXe4F6x7mB8oPxY5XLptrBq')
    const inputValue = normalizeValue(`/ipfs/${cid}`)
    const expectedValue = `/ipfs/${cid.toV1()}`
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)

    const pb = IPNSEntry.decode(IPNSEntry.encode(record))
    pb.data = encodeExtensibleData({
      Value: uint8ArrayFromString(inputValue),
      ValidityType: pb.validityType ?? IPNSEntry.ValidityType.EOL,
      Validity: pb.validity ?? new Uint8Array(0),
      Sequence: pb.sequence ?? 0n,
      TTL: pb.ttl ?? 0n
    })
    pb.value = uint8ArrayFromString(inputValue)

    const modifiedRecord = IPNSEntry.decode(IPNSEntry.encode(pb))
    const modifiedRecordData = decodeExtensibleData(modifiedRecord.data)
    expect(modifiedRecordData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should normalize value when reading an ipns record (string v1 cid path)', async () => {
    const inputValue = normalizeValue('/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu')
    const expectedValue = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
    const record = await createIPNSRecord(privateKey, inputValue, 0, 1000000)

    const pb = IPNSEntry.decode(IPNSEntry.encode(record))
    pb.data = encodeExtensibleData({
      Value: uint8ArrayFromString(inputValue),
      ValidityType: pb.validityType ?? IPNSEntry.ValidityType.EOL,
      Validity: pb.validity ?? new Uint8Array(0),
      Sequence: pb.sequence ?? 0n,
      TTL: pb.ttl ?? 0n
    })
    pb.value = uint8ArrayFromString(inputValue)

    const marshalledRecord = IPNSEntry.encode(record)

    const modifiedRecord = IPNSEntry.decode(marshalledRecord)
    const modifiedRecordData = decodeExtensibleData(modifiedRecord.data)
    expect(modifiedRecordData.Value).to.equalBytes(uint8ArrayFromString(expectedValue))
  })

  it('should fail to validate a v1 (deprecated legacy) message', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      v1Compatible: true
    })
    const pb = IPNSEntry.decode(IPNSEntry.encode(record))

    // remove the extra fields added for v2 sigs
    delete record.data
    delete record.signatureV2

    // confirm a v1 exists
    expect(pb).to.have.property('signatureV1')

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should fail to validate a v2 without v2 signature (ignore v1)', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity, {
      v1Compatible: true
    })
    const pb = IPNSEntry.decode(IPNSEntry.encode(record))

    // remove v2 sig
    delete record.signatureV2

    // confirm a v1 exists
    expect(pb).to.have.property('signatureV1')

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should fail to validate a bad record', async () => {
    const sequence = 0
    const validity = 1_000_000
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    // corrupt the record by changing the value to random bytes
    const data = decodeExtensibleData(record.data)
    data.Value = crypto.getRandomValues(new Uint8Array(46))
    record.data = withArrayBuffer(cbor.encode(data))

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should create an ipns record with a validity of 1 nanosecond correctly and it should not be valid 1ms later', async () => {
    const sequence = 0
    const validity = 0.00001

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    await new Promise(resolve => setTimeout(resolve, 1))

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', RecordExpiredError.name)
  })

  it('should create an ipns record, marshal and unmarshal it, as well as validate it correctly', async () => {
    const sequence = 0
    const validity = 1000000

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const createdRecord = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    const marshaledData = IPNSEntry.encode(createdRecord)
    const extensibleData = decodeExtensibleData(createdRecord.data)

    const validatedRecord = await ipnsValidator(routingKey, marshaledData, kc)
    const validatedExtensibleData = decodeExtensibleData(validatedRecord.data)

    expect(validatedExtensibleData.Value).to.deep.equal(extensibleData.Value, 'Value did not match')
    expect(validatedExtensibleData.Validity).to.deep.equal(extensibleData.Validity, 'Validity did not match')
    expect(validatedExtensibleData.ValidityType).to.equal(extensibleData.ValidityType, 'ValidityType did not match')
    expect(validatedExtensibleData.Sequence).to.equal(extensibleData.Sequence, 'Sequence did not match')
    expect(validatedExtensibleData.TTL).to.equal(extensibleData.TTL, 'TTL did not match')

    expect(createdRecord.signatureV1).to.be.ok('createdRecord did not have v1-style signatureV1')
    expect(createdRecord.sequence).to.equal(BigInt(sequence), 'createdRecord did not have v1-style sequence')
    expect(createdRecord.ttl).to.be.ok('createdRecord did not have v1-style TTL')

    expect(validatedRecord.signatureV2).to.equalBytes(createdRecord.signatureV2, 'validatedRecord signatureV2 did not match')
    expect(validatedRecord.data).to.equalBytes(createdRecord.data, 'validatedRecord data did not match')

    expect(validatedRecord.signatureV1).to.be.ok('validatedRecord did not have v1-style signatureV1')
    expect(validatedRecord.sequence).to.equal(BigInt(sequence), 'validatedRecord did not have v1-style sequence')
    expect(validatedRecord.ttl).to.be.ok('validatedRecord did not have v1-style TTL')
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
    expect(record.publicKey).to.deep.equal(privateKey.publicKey.toProtobuf())

    const pb = IPNSEntry.decode(IPNSEntry.encode(record))
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
    const privateKey = await crypto.generatePrivateKey()
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    expect(record).to.not.have.property('pubKey') // ed25519 keys should not be embedded
  })

  it('validator with no valid public key should error', async () => {
    const sequence = 0
    const validity = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)
    delete record.publicKey

    const routingKey = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', InvalidEmbeddedPublicKeyError.name)
  })

  it('should be able to export a previously embedded public key from an ipns record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey, contentPath, sequence, validity)

    expect(record.publicKey).to.equalBytes(privateKey.publicKey.toProtobuf())
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
    const data = decodeExtensibleData(input.data)
    data.Value = cid.bytes
    input.data = withArrayBuffer(cbor.encode(data))

    // re-sign record
    const sigData = ipnsRecordDataForV2Sig(input.data)
    input.signatureV2 = await privateKey.sign(sigData)

    const marshalledRecord = IPNSEntry.encode(input)
    const validatedRecord = await ipnsValidator(routingKey, marshalledRecord, kc)
    const validatedExtensibleData = decodeExtensibleData(validatedRecord.data)

    expect(validatedExtensibleData).to.have.property('Value').that.equalBytes(cid.bytes)
  })

  it('should round trip kubo records to bytes and back', async () => {
    // the IPNS spec gives an example for the Validity field as
    // 1970-01-01T00:00:00.000000001Z - e.g. nanosecond precision but Kubo only
    // uses microsecond precision. The value is a timestamp as defined by
    // rfc3339 which doesn't have a strong opinion on fractions of seconds so
    // both are valid but we must be able to round trip them intact.
    const unmarshaled = IPNSEntry.decode(kuboRecord.bytes)
    const reMarshaled = IPNSEntry.encode(unmarshaled)

    const reUnmarshaled = IPNSEntry.decode(reMarshaled)

    expect(unmarshaled).to.deep.equal(reUnmarshaled)
    expect(reMarshaled).to.equalBytes(kuboRecord.bytes)
  })
})
