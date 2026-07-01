import { rsaCrypto } from '@ipshipyard/crypto'
import { expect } from 'aegir/chai'
import { createIPNSRecord } from '../src/records.ts'
import { ipnsSelector } from '../src/selector.ts'
import { multihashToIPNSRoutingKey } from '../src/utils.ts'
import type { PrivateKey } from '@helia/interface'

describe('selector', function () {
  this.timeout(20 * 1000)

  const contentPath = '/ipfs/bafkqae3imvwgy3zamzzg63janjzs22lqnzzqu'
  let privateKey: PrivateKey

  before(async () => {
    const crypto = rsaCrypto()
    privateKey = await crypto.generatePrivateKey()
  })

  it('should use validator.select to select the record with the highest sequence number', async () => {
    const sequence = 0
    const lifetime = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, lifetime)
    const newRecord = await createIPNSRecord(privateKey, contentPath, (sequence + 1), lifetime)

    const key = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    let valid = ipnsSelector(key, [newRecord, record])
    expect(valid).to.equal(0) // new data is the selected one

    valid = ipnsSelector(key, [record, newRecord])
    expect(valid).to.equal(1) // new data is the selected one
  })

  it('should use validator.select to select the record with the longest validity', async () => {
    const sequence = 0
    const lifetime = 1000000

    const record = await createIPNSRecord(privateKey, contentPath, sequence, lifetime)
    const newRecord = await createIPNSRecord(privateKey, contentPath, sequence, (lifetime + 1))

    const key = multihashToIPNSRoutingKey(privateKey.publicKey.toMultihash())

    let valid = ipnsSelector(key, [newRecord, record])
    expect(valid).to.equal(0) // new data is the selected one

    valid = ipnsSelector(key, [record, newRecord])
    expect(valid).to.equal(1) // new data is the selected one
  })
})
