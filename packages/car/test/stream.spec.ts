/* eslint-env mocha */

import { type UnixFS, unixfs } from '@helia/unixfs'
import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'
import * as raw from 'multiformats/codecs/raw'
import { car, type Car } from '../src/index.js'
import { smallFile } from './fixtures/files.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { DAGWalker } from '@helia/interface'
import type { Blockstore } from 'interface-blockstore'

/**
 * Dag walker for dag-pb CIDs
 */
const dagPbWalker: DAGWalker = {
  codec: dagPb.code,
  * walk (block) {
    const node = dagPb.decode(block)

    yield * node.Links.map(l => l.Hash)
  }
}

const rawWalker: DAGWalker = {
  codec: raw.code,
  * walk () {
    // no embedded CIDs in a raw block
  }
}

describe('stream car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS
  let dagWalkers: Record<number, DAGWalker>

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    dagWalkers = {
      [dagPb.code]: dagPbWalker,
      [raw.code]: rawWalker
    }

    c = car({ blockstore, dagWalkers })
    u = unixfs({ blockstore })
  })

  it('streams car file', async () => {
    const cid = await u.addBytes(smallFile)

    const writer = memoryCarWriter(cid)
    await c.export(cid, writer)

    const bytes = await writer.bytes()

    const streamed = await toBuffer(c.stream(cid))

    expect(bytes).to.equalBytes(streamed)
  })
})
