import { rsaCrypto } from '@ipshipyard/crypto'
import { keychain } from '@ipshipyard/keychain'
import { expect } from 'aegir/chai'
import * as cborg from 'cborg'
import { MemoryDatastore } from 'datastore-core'
import { withArrayBuffer } from 'uint8arrays/with-array-buffer'
import { InvalidEmbeddedPublicKeyError, RecordTooLargeError, SignatureVerificationError, UnsupportedValidityError } from '../src/errors.ts'
import { IPNSEntry } from '../src/pb/ipns.ts'
import { createIPNSRecord } from '../src/records.ts'
import { decodeExtensibleData, encodeExtensibleData, ipnsRecordDataForV2Sig, multihashToIPNSRoutingKey } from '../src/utils.ts'
import { ipnsValidator, validFor } from '../src/validator.ts'
import { getCrypto } from './fixtures/get-crypto.ts'
import type { Keychain, PrivateKey } from '@helia/interface'

describe('validator', function () {
  this.timeout(20 * 1000)

  const contentPath = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
  let privateKey1: PrivateKey
  let privateKey2: PrivateKey
  let kc: Keychain

  before(async () => {
    const crypto = rsaCrypto()
    privateKey1 = await crypto.generatePrivateKey()
    privateKey2 = await crypto.generatePrivateKey()
    kc = keychain()({
      datastore: new MemoryDatastore(),
      getCrypto
    })
  })

  it('should validate a (V2) record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity, { v1Compatible: false })
    const routingKey = multihashToIPNSRoutingKey(privateKey1.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await ipnsValidator(routingKey, marshalledRecord, kc)
  })

  it('should validate a (V1+V2) record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity, { v1Compatible: true })
    const routingKey = multihashToIPNSRoutingKey(privateKey1.publicKey.toMultihash())
    const marshalledRecord = IPNSEntry.encode(record)

    await ipnsValidator(routingKey, marshalledRecord, kc)
  })

  it('should use validator.validate to verify that a record is not valid', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)
    const routingKey = multihashToIPNSRoutingKey(privateKey1.publicKey.toMultihash())

    // corrupt the record by changing the value to random bytes
    const data = decodeExtensibleData(record.data)
    data.Data = `not original value ${Math.random()}`
    record.data = withArrayBuffer(cborg.encode(data))

    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should use validator.validate to verify that a record is not valid when no key is embedded', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)
    const routingKey = multihashToIPNSRoutingKey(privateKey1.publicKey.toMultihash())

    delete record.publicKey

    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', InvalidEmbeddedPublicKeyError.name)
  })

  it('should use validator.validate to verify that a record is not valid when the wrong key is embedded', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)
    const routingKey = multihashToIPNSRoutingKey(privateKey1.publicKey.toMultihash())

    record.publicKey = privateKey2.publicKey.toProtobuf()

    const marshalledRecord = IPNSEntry.encode(record)

    await expect(ipnsValidator(routingKey, marshalledRecord, kc)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should limit the size of incoming records', async () => {
    const marshalledData = new Uint8Array(1024 * 1024)
    const key = new Uint8Array()

    await expect(ipnsValidator(key, marshalledData, kc)).to.eventually.be.rejected()
      .with.property('name', RecordTooLargeError.name)
  })

  describe('validFor', () => {
    it('should return the number of milliseconds until the record expires', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 1000000)
      const result = validFor(record)
      expect(result).to.be.greaterThan(0)
    })

    it('should return 0 for expired records', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 0)

      expect(validFor(record)).to.equal(0)
    })

    it('should throw UnsupportedValidityError for non-EOL validity types', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 1000000)
      const data = decodeExtensibleData(record.data)
      data.ValidityType = 5 as any

      // re-sign record
      record.data = encodeExtensibleData(data)
      const sigData = ipnsRecordDataForV2Sig(record.data)
      record.signatureV2 = await privateKey1.sign(sigData)

      expect(() => validFor(record)).to.throw(UnsupportedValidityError)
    })

    it('should throw UnsupportedValidityError for null validity', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 1000000)
      const data = decodeExtensibleData(record.data)
      data.ValidityType = null as any

      // re-sign record
      record.data = encodeExtensibleData(data)
      const sigData = ipnsRecordDataForV2Sig(record.data)
      record.signatureV2 = await privateKey1.sign(sigData)

      expect(() => validFor(record)).to.throw(UnsupportedValidityError)
    })

    it('should return correct milliseconds until expiration', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 5000)

      const result = validFor(record)

      expect(result).to.be.within(4900, 5000)
    })
  })
})
