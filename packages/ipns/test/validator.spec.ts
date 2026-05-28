import { rsaCrypto } from '@ipshipyard/crypto'
import { keychain } from '@ipshipyard/keychain'
import { expect } from 'aegir/chai'
import * as cborg from 'cborg'
import { MemoryDatastore } from 'datastore-core'
import { InvalidEmbeddedPublicKeyError, RecordTooLargeError, SignatureVerificationError, UnsupportedValidityError } from '../src/errors.ts'
import { createIPNSRecord, unmarshalIPNSRecord } from '../src/records.ts'
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

    await ipnsValidator(record)
  })

  it('should validate a (V1+V2) record', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity, { v1Compatible: true })

    await ipnsValidator(record)
  })

  it('should use validator.validate to verify that a record is not valid', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)

    // corrupt the record by changing the value to random bytes
    const data = cborg.decode(record.data)
    data.Data = `not original value ${Math.random()}`
    record.data = cborg.encode(data)

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should use validator.validate to verify that a record is not valid when no key is embedded', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)

    // @ts-expect-error publicKey is not optional
    delete record.publicKey

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', InvalidEmbeddedPublicKeyError.name)
  })

  it('should use validator.validate to verify that a record is not valid when the wrong key is embedded', async () => {
    const sequence = 0
    const validity = 1000000
    const record = await createIPNSRecord(privateKey1, contentPath, sequence, validity)

    record.publicKey = privateKey2.publicKey

    await expect(ipnsValidator(record)).to.eventually.be.rejected()
      .with.property('name', SignatureVerificationError.name)
  })

  it('should limit the size of incoming records', async () => {
    const marshalledData = new Uint8Array(1024 * 1024)
    const key = new Uint8Array()

    await expect(unmarshalIPNSRecord(key, marshalledData, kc)).to.eventually.be.rejected()
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
      record.validityType = 5 as any

      expect(() => validFor(record)).to.throw(UnsupportedValidityError)
    })

    it('should throw UnsupportedValidityError for null validity', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 1000000)
      record.validityType = null as any

      expect(() => validFor(record)).to.throw(UnsupportedValidityError)
    })

    it('should return correct milliseconds until expiration', async () => {
      const record = await createIPNSRecord(privateKey1, contentPath, 0, 5000)

      const result = validFor(record)

      expect(result).to.be.within(4900, 5000)
    })
  })
})
