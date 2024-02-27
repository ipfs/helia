/* eslint-env mocha */

import { type UnixFS, unixfs } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'
import { car, type Car } from '../src/index.js'
import { smallFile } from './fixtures/files.js'
import { getCodec } from './fixtures/get-codec.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('stream car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    c = car({ blockstore, getCodec })
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
