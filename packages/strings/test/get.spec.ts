/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { strings, Strings } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'

describe('get', () => {
  let blockstore: Blockstore
  let str: Strings
  let cid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    str = strings({ blockstore })
    cid = await str.add('hello world')
  })

  it('adds a string', async () => {
    const string = await str.get(cid)

    expect(`${string}`).to.equal('hello world')
  })
})
