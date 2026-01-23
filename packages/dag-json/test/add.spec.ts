import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { identity } from 'multiformats/hashes/identity'
import { dagJson } from '../src/index.js'
import type { DAGJSON } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('put', () => {
  let blockstore: Blockstore
  let d: DAGJSON

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    d = dagJson({ blockstore })
  })

  it('adds an object', async () => {
    const cid = await d.add({
      hello: 'world'
    })

    // spellchecker:disable-next-line
    expect(`${cid}`).to.equal('baguqeerasords4njcts6vs7qvdjfcvgnume4hqohf65zsfguprqphs3icwea')
  })

  it('adds an object with a non-default hashing algorithm', async () => {
    const cid = await d.add({
      hello: 'world'
    }, {
      hasher: identity
    })

    // spellchecker:disable-next-line
    expect(`${cid}`).to.equal('baguqeaarpmrgqzlmnrxseorco5xxe3deej6q')
  })
})
