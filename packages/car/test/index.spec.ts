/* eslint-env mocha */

import { mfs } from '@helia/mfs'
import { type UnixFS, unixfs } from '@helia/unixfs'
import { CarReader } from '@ipld/car'
import { createScalableCuckooFilter } from '@libp2p/utils/filters'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import toBuffer from 'it-to-buffer'
import { car, type Car } from '../src/index.js'
import { dagWalkers } from './fixtures/dag-walkers.js'
import { largeFile, smallFile } from './fixtures/files.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('import/export car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    c = car({ blockstore, dagWalkers })
    u = unixfs({ blockstore })
  })

  it('exports and imports a car file', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })
    const cid = await otherUnixFS.addBytes(smallFile)

    const writer = memoryCarWriter(cid)
    await otherCar.export(cid, writer)

    const reader = await CarReader.fromBytes(await writer.bytes())

    await c.import(reader)

    expect(await blockstore.get(cid)).to.equalBytes(smallFile)
  })

  it('exports and imports a multiple root car file', async () => {
    const fileData1 = Uint8Array.from([0, 1, 2, 3])
    const fileData2 = Uint8Array.from([4, 5, 6, 7])
    const fileData3 = Uint8Array.from([8, 9, 0, 1])

    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })
    const cid1 = await otherUnixFS.addBytes(fileData1)
    const cid2 = await otherUnixFS.addBytes(fileData2)
    const cid3 = await otherUnixFS.addBytes(fileData3)

    const writer = memoryCarWriter([cid1, cid2, cid3])
    await otherCar.export([cid1, cid2, cid3], writer)

    const reader = await CarReader.fromBytes(await writer.bytes())

    await c.import(reader)

    expect(await toBuffer(u.cat(cid1))).to.equalBytes(fileData1)
    expect(await toBuffer(u.cat(cid2))).to.equalBytes(fileData2)
    expect(await toBuffer(u.cat(cid3))).to.equalBytes(fileData3)
  })

  it('exports and imports a multiple block car file', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })
    const cid = await otherUnixFS.addBytes(largeFile)

    const writer = memoryCarWriter(cid)
    await otherCar.export(cid, writer)

    const reader = await CarReader.fromBytes(await writer.bytes())

    await c.import(reader)

    expect(await toBuffer(u.cat(cid))).to.equalBytes(largeFile)
  })

  it('exports and imports a multiple block, multiple root car file', async () => {
    const fileData1 = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])
    const fileData2 = Uint8Array.from([4, 5, 6, 7, 8, 9, 0, 1])
    const fileData3 = Uint8Array.from([8, 9, 0, 1, 2, 3, 4, 5])

    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })
    const cid1 = await otherUnixFS.addBytes(fileData1, {
      chunker: fixedSize({
        chunkSize: 2
      })
    })
    const cid2 = await otherUnixFS.addBytes(fileData2, {
      chunker: fixedSize({
        chunkSize: 2
      })
    })
    const cid3 = await otherUnixFS.addBytes(fileData3, {
      chunker: fixedSize({
        chunkSize: 2
      })
    })

    const writer = memoryCarWriter([cid1, cid2, cid3])
    await otherCar.export([cid1, cid2, cid3], writer)

    const reader = await CarReader.fromBytes(await writer.bytes())

    await c.import(reader)

    expect(await toBuffer(u.cat(cid1))).to.equalBytes(fileData1)
    expect(await toBuffer(u.cat(cid2))).to.equalBytes(fileData2)
    expect(await toBuffer(u.cat(cid3))).to.equalBytes(fileData3)
  })

  it('exports a car file without duplicates', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherDatastore = new MemoryDatastore()
    const otherMFS = mfs({ blockstore: otherBlockstore, datastore: otherDatastore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })

    await otherMFS.mkdir('/testDups')
    await otherMFS.mkdir('/testDups/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDups/a.smallfile')
    await otherMFS.cp(sourceCid, '/testDups/sub/b.smallfile')

    const rootObject = await otherMFS.stat('/testDups/')
    const rootCid = rootObject.cid

    const writer = memoryCarWriter(rootCid)
    const blockFilter = createScalableCuckooFilter(5)
    await otherCar.export(rootCid, writer, {
      blockFilter
    })

    const carBytes = await writer.bytes()
    expect(carBytes.length).to.equal(349)
  })

  it('exports a car file with duplicates', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherDatastore = new MemoryDatastore()
    const otherMFS = mfs({ blockstore: otherBlockstore, datastore: otherDatastore })
    const otherCar = car({ blockstore: otherBlockstore, dagWalkers })

    await otherMFS.mkdir('/testDups')
    await otherMFS.mkdir('/testDups/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDups/a.smallfile')
    await otherMFS.cp(sourceCid, '/testDups/sub/b.smallfile')

    const rootObject = await otherMFS.stat('/testDups/')
    const rootCid = rootObject.cid

    const writer = memoryCarWriter(rootCid)
    await otherCar.export(rootCid, writer)

    const carBytes = await writer.bytes()
    expect(carBytes.length).to.equal(399)
  })
})
