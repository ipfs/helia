import { keychain } from '@ipshipyard/keychain'
import { expect } from 'aegir/chai'
import loadFixture from 'aegir/fixtures'
import { MemoryDatastore } from 'datastore-core'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import { SignatureVerificationError } from '../src/errors.ts'
import { marshalIPNSRecord, multihashToIPNSRoutingKey, unmarshalIPNSRecord } from '../src/records.ts'
import { ipnsValidator } from '../src/validator.ts'
import { getCrypto } from './fixtures/get-crypto.ts'
import type { Keychain } from '@ipshipyard/keychain'

describe('conformance', function () {
  let kc: Keychain

  beforeEach(() => {
    kc = keychain()({
      datastore: new MemoryDatastore(),
      getCrypto
    })
  })

  it('should reject a v1 only record', async () => {
    const cid = CID.parse('k51qzi5uqu5dm4tm0wt8srkg9h9suud4wuiwjimndrkydqm81cqtlb5ak6p7ku')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v1.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)

    await expect(unmarshalIPNSRecord(routingKey, buf, kc)).to.be.rejectedWith(/Missing data or signatureV2/)
      .eventually.with.property('name', SignatureVerificationError.name)
  })

  it('should validate a record with v1 and v2 signatures', async () => {
    const cid = CID.parse('k51qzi5uqu5dlkw8pxuw9qmqayfdeh4kfebhmreauqdc6a7c3y7d5i9fi8mk9w')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v1-v2.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)
    const record = await unmarshalIPNSRecord(routingKey, buf, kc)

    await ipnsValidator(record)

    expect(record.value).to.equal('/ipfs/bafkqaddwgevxmmraojswg33smq')
  })

  it('should reject a record with inconsistent value fields', async () => {
    const cid = CID.parse('k51qzi5uqu5dlmit2tuwdvnx4sbnyqgmvbxftl0eo3f33wwtb9gr7yozae9kpw')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v1-v2-broken-v1-value.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)

    await expect(unmarshalIPNSRecord(routingKey, buf, kc)).to.be.rejectedWith(/Field "value" did not match/)
      .eventually.with.property('name', SignatureVerificationError.name)
  })

  it('should reject a record with v1 and v2 signatures but invalid v2', async () => {
    const cid = CID.parse('k51qzi5uqu5diamp7qnnvs1p1gzmku3eijkeijs3418j23j077zrkok63xdm8c')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v1-v2-broken-signature-v2.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)
    const record = await unmarshalIPNSRecord(routingKey, buf, kc)

    await expect(ipnsValidator(record)).to.eventually.be.rejectedWith(/Record signature verification failed/)
      .eventually.with.property('name', SignatureVerificationError.name)
  })

  it('should reject a record with v1 and v2 signatures but invalid v1', async () => {
    const cid = CID.parse('k51qzi5uqu5dilgf7gorsh9vcqqq4myo6jd4zmqkuy9pxyxi5fua3uf7axph4y')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v1-v2-broken-signature-v1.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)

    const record = await unmarshalIPNSRecord(routingKey, buf, kc)

    expect(record.value).to.equal('/ipfs/bafkqahtwgevxmmrao5uxi2bamjzg623fnyqhg2lhnzqxi5lsmuqhmmi')
  })

  it('should validate a record with only v2 signature', async () => {
    const cid = CID.parse('k51qzi5uqu5dit2ku9mutlfgwyz8u730on38kd10m97m36bjt66my99hb6103f')
    const buf = loadFixture(`test/fixtures/${cid.toString(base36)}_v2.ipns-record`)
    const routingKey = multihashToIPNSRoutingKey(cid.multihash)
    const record = await unmarshalIPNSRecord(routingKey, buf, kc)

    await ipnsValidator(record)

    expect(record.value).to.equal('/ipfs/bafkqadtwgiww63tmpeqhezldn5zgi')
  })

  it('should round trip fixtures', async () => {
    const fixtures = [{
      cid: CID.parse('k51qzi5uqu5dlkw8pxuw9qmqayfdeh4kfebhmreauqdc6a7c3y7d5i9fi8mk9w'),
      fixture: 'test/fixtures/k51qzi5uqu5dlkw8pxuw9qmqayfdeh4kfebhmreauqdc6a7c3y7d5i9fi8mk9w_v1-v2.ipns-record'
    }, {
      cid: CID.parse('k51qzi5uqu5diamp7qnnvs1p1gzmku3eijkeijs3418j23j077zrkok63xdm8c'),
      // spellchecker:disable-next-line
      fixture: 'test/fixtures/k51qzi5uqu5diamp7qnnvs1p1gzmku3eijkeijs3418j23j077zrkok63xdm8c_v1-v2-broken-signature-v2.ipns-record'
    }, {
      cid: CID.parse('k51qzi5uqu5dilgf7gorsh9vcqqq4myo6jd4zmqkuy9pxyxi5fua3uf7axph4y'),
      fixture: 'test/fixtures/k51qzi5uqu5dilgf7gorsh9vcqqq4myo6jd4zmqkuy9pxyxi5fua3uf7axph4y_v1-v2-broken-signature-v1.ipns-record'
    }, {
      cid: CID.parse('k51qzi5uqu5dit2ku9mutlfgwyz8u730on38kd10m97m36bjt66my99hb6103f'),
      fixture: 'test/fixtures/k51qzi5uqu5dit2ku9mutlfgwyz8u730on38kd10m97m36bjt66my99hb6103f_v2.ipns-record'
    }]

    for (const { cid, fixture } of fixtures) {
      const routingKey = multihashToIPNSRoutingKey(cid.multihash)
      const buf = loadFixture(fixture)
      const record = await unmarshalIPNSRecord(routingKey, buf, kc)
      const marshalled = marshalIPNSRecord(record)

      expect(buf).to.equalBytes(marshalled, `Failed to round trip ${cid}`)
    }
  })
})
