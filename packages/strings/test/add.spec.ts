/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { strings, Strings } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'

describe('put', () => {
  let blockstore: Blockstore
  let str: Strings

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    str = strings({ blockstore })
  })

  it('adds a string', async () => {
    const cid = await str.add('hello world')

    expect(`${cid}`).to.equal('bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e')
  })
})
