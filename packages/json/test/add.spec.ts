/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { identity } from 'multiformats/hashes/identity'
import { json, type JSON } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('put', () => {
  let blockstore: Blockstore
  let j: JSON

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    j = json({ blockstore })
  })

  it('adds an object', async () => {
    const cid = await j.add({
      hello: 'world'
    })

    expect(`${cid}`).to.equal('bagaaierasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea')
  })

  it('adds an object with a non-default hashing algorithm', async () => {
    const cid = await j.add({
      hello: 'world'
    }, {
      hasher: identity
    })

    expect(`${cid}`).to.equal('bagaaiaarpmrgqzlmnrxseorco5xxe3deej6q')
  })
})
