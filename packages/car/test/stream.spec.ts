/* eslint-env mocha */

import { type UnixFS, unixfs } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'
import Sinon from 'sinon'
import { car, type Car } from '../src/index.js'
import { dagWalkers } from './fixtures/dag-walkers.js'
import { largeFile, smallFile } from './fixtures/files.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('stream car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

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

  it('errors when writing during streaming car file', async () => {
    const exportSpy = Sinon.spy(c, 'export')
    const cid = await u.addBytes(largeFile)
    const iter = c.stream(cid)

    // start stream moving so we can get at the CAR writer
    await iter.next()

    expect(exportSpy.called).to.be.true()

    // make the next write error
    const writer = exportSpy.getCall(0).args[1]
    writer.put = async () => {
      throw new Error('Urk!')
    }
})
