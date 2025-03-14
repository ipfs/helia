/* eslint-env mocha */

import { mfs } from '@helia/mfs'
import { type UnixFS, unixfs } from '@helia/unixfs'
import { CarReader } from '@ipld/car'
import { createScalableCuckooFilter } from '@libp2p/utils/filters'
import { expect } from 'aegir/chai'
import loadFixtures from 'aegir/fixtures'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { car, type Car } from '../src/index.js'
import { largeFile, smallFile } from './fixtures/files.js'
import { getCodec } from './fixtures/get-codec.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'
describe('import/export car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    c = car({ blockstore, getCodec })
    u = unixfs({ blockstore })
  })

  it('exports and imports a car file', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec })
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
    const otherCar = car({ blockstore: otherBlockstore, getCodec })
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
    const otherCar = car({ blockstore: otherBlockstore, getCodec })
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
    const otherCar = car({ blockstore: otherBlockstore, getCodec })
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
    const otherCar = car({ blockstore: otherBlockstore, getCodec })

    await otherMFS.mkdir('/testDuplicates')
    await otherMFS.mkdir('/testDuplicates/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDuplicates/a.small-file')
    await otherMFS.cp(sourceCid, '/testDuplicates/sub/b.small-file')

    const rootObject = await otherMFS.stat('/testDuplicates/')
    const rootCid = rootObject.cid

    const writer = memoryCarWriter(rootCid)
    const blockFilter = createScalableCuckooFilter(5)
    await otherCar.export(rootCid, writer, {
      blockFilter
    })

    const carBytes = await writer.bytes()
    expect(carBytes.length).to.equal(351)
  })

  it('exports a car file with duplicates', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherDatastore = new MemoryDatastore()
    const otherMFS = mfs({ blockstore: otherBlockstore, datastore: otherDatastore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec })

    await otherMFS.mkdir('/testDuplicates')
    await otherMFS.mkdir('/testDuplicates/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDuplicates/a.small-file')
    await otherMFS.cp(sourceCid, '/testDuplicates/sub/b.small-file')

    const rootObject = await otherMFS.stat('/testDuplicates/')
    const rootCid = rootObject.cid

    const writer = memoryCarWriter(rootCid)
    await otherCar.export(rootCid, writer)

    const carBytes = await writer.bytes()
    expect(carBytes.length).to.equal(401)
  })

  it('generates a proper car file with dag-scope=all', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    const roots = await reader.getRoots()

    await c.import(reader)

    // export a car file, and ensure the car file is the same as the original
    const writer = memoryCarWriter(roots)
    await c.export(roots, writer)
    const ourCarBytes = await writer.bytes()

    const ourReader = await CarReader.fromBytes(ourCarBytes)

    const ourRoots = await ourReader.getRoots()
    expect(ourRoots).to.deep.equal(roots)

    // check that every single block is the same as the blocks in the reader
    for await (const block of ourReader.blocks()) {
      expect(await reader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }
    for await (const block of reader.blocks()) {
      expect(await ourReader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }

    expect(ourCarBytes.length).to.equal(carBytes.length)
  })

  it('can generate a proper dag-scope=all car for a subdag', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    // import all the blocks from the car file
    await c.import(reader)

    // export the subdag: ipfs://bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu/subdir,
    const subdagRoot = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
    const writer = memoryCarWriter(subdagRoot)
    await c.export(subdagRoot, writer, { dagRoot: CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu') })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()

    expect(roots).to.deep.equal([subdagRoot])

    // make sure that all the same blocks are present, because dag-scope=all says:
    // Transmit the entire contiguous DAG that begins at the end of the path query, after blocks required to verify path segments
    for await (const block of ourReader.blocks()) {
      expect(await reader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }
    for await (const block of reader.blocks()) {
      expect(await ourReader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }
  })
})
