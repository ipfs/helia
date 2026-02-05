import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { identity } from 'multiformats/hashes/identity'
import { dagCbor } from '../src/index.js'
import type { DAGCBOR } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('put', () => {
  let blockstore: Blockstore
  let d: DAGCBOR

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    d = dagCbor({ blockstore })
  })

  it('adds an object', async () => {
    const cid = await d.add({
      hello: 'world'
    })

    // spellchecker:disable-next-line
    expect(`${cid}`).to.equal('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')
  })

  it('adds an object with a non-default hashing algorithm', async () => {
    const cid = await d.add({
      hello: 'world'
    }, {
      hasher: identity
    })

    // spellchecker:disable-next-line
    expect(`${cid}`).to.equal('bafyqadnbmvugk3dmn5sxo33snrsa')
  })
})
