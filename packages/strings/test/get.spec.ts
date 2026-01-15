import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { strings } from '../src/index.js'
import type { Strings } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('get', () => {
  let blockstore: Blockstore
  let str: Strings
  let cid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    str = strings({ blockstore })
    cid = await str.add('hello world')
  })

  it('gets a string', async () => {
    const string = await str.get(cid)

    expect(`${string}`).to.equal('hello world')
  })

  it('gets a string with a non-default hashing algorithm', async () => {
    const input = 'hello world'
    const cid = await str.add(input, {
      hasher: identity
    })

    await expect(str.get(cid)).to.eventually.equal(input)
  })

  it('rejects if CID codec is not equal to RAW codec', async () => {
    const rawCID = CID.createV1(0x00, cid.multihash)
    await expect(str.get(rawCID)).to.eventually.be.rejected
      .with.property('name', 'InvalidCodecError')
  })
})
