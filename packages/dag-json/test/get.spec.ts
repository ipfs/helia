/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { dagJson } from '../src/index.js'
import type { DAGJSON } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('get', () => {
  let blockstore: Blockstore
  let d: DAGJSON
  let cid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    d = dagJson({ blockstore })
    cid = await d.add({
      hello: 'world'
    })
  })

  it('gets an object', async () => {
    const result = await d.get(cid)

    expect(result).to.deep.equal({
      hello: 'world'
    })
  })

  it('gets an object with a non-default hashing algorithm', async () => {
    const input = {
      hello: 'world'
    }
    const cid = await d.add(input, {
      hasher: identity
    })

    await expect(d.get(cid)).to.eventually.deep.equal(input)
  })

  it('rejects if CID codec is not equal to DAG-JSON codec', async () => {
    const rawCID = CID.createV1(0x55, cid.multihash)
    await expect(d.get(rawCID)).to.eventually.be.rejected
      .with.property('name', 'InvalidCodecError')
  })
})
