/* eslint-env mocha */

import { CarReader } from '@ipld/car'
import { expect } from 'aegir/chai'
import loadFixtures from 'aegir/fixtures'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { car, type Car } from '../src/index.js'
import { DagScope } from '../src/index.js'
import { getCodec } from './fixtures/get-codec.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('dag-scope', () => {
  let blockstore: Blockstore
  let c: Car
  let blockstoreGetSpy: sinon.SinonSpy

  beforeEach(async () => {
    blockstore = sinon.spy(new MemoryBlockstore())
    blockstoreGetSpy = blockstore.get as sinon.SinonSpy

    c = car({ blockstore, getCodec })
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

    // make sure that all the same blocks are present, because dag-scope=all says:
    // Transmit the entire contiguous DAG that begins at the end of the path query, after blocks required to verify path segments
    for await (const block of ourReader.blocks()) {
      expect(await reader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }
    for await (const block of reader.blocks()) {
      expect(await ourReader.has(block.cid)).to.be.true(`Block ${block.cid} not found in the original car file`)
    }

    expect(ourCarBytes.length).to.equal(carBytes.length)

    expect(blockstoreGetSpy.callCount).to.equal(10) // 10 blocks in the subdag
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

    expect(blockstoreGetSpy.callCount).to.equal(10) // 10 blocks in the subdag
  })

  it('can use knownDagPath to optimize car export', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    await c.import(reader)

    const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
    const intermediateCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
    const subdagRoot = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')

    const knownDagPath = [dagRoot, intermediateCid, subdagRoot]

    // Export using knownDagPath
    const writer = memoryCarWriter(subdagRoot)
    await c.export(subdagRoot, writer, {
      dagRoot,
      knownDagPath
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    // Verify the exported CAR contains the correct roots
    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([subdagRoot])

    expect(blockstoreGetSpy.getCall(0).args[0]).to.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(2).args[0]).to.equal(knownDagPath[2])
    expect(blockstoreGetSpy.callCount).to.equal(3)
  })

  it('can generate a car file with dag-scope=block', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    await c.import(reader)

    const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
    const writer = memoryCarWriter(dagRoot)
    // export the root block only with dag-scope=block
    await c.export(dagRoot, writer, { dagScope: DagScope.BLOCK })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([dagRoot])

    // Verify only one block (the root) is present in the exported car
    let blockCount = 0
    for await (const block of ourReader.blocks()) {
      blockCount++
      expect(block.cid.toString()).to.equal(dagRoot.toString())
    }
    expect(blockCount).to.equal(1)

    expect(blockstoreGetSpy.callCount).to.equal(1)
  })

  it('can generate a car file with dag-scope=entity for non-UnixFS data', async () => {
    // dag-cbor only blocks in this car file
    const carBytes = loadFixtures('test/fixtures/bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    await c.import(reader)

    // Since we're dealing with non-UnixFS data, entity should behave like block
    const dagRoot = CID.parse('bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei')
    const writer = memoryCarWriter(dagRoot)
    await c.export(dagRoot, writer, { dagScope: DagScope.ENTITY })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([dagRoot])

    // For non-UnixFS data, entity should behave like block - only one block should be present
    let blockCount = 0
    for await (const block of ourReader.blocks()) {
      blockCount++
      // Ensure the block is the root block
      expect(block.cid.toString()).to.equal(dagRoot.toString())
    }
    expect(blockCount).to.equal(1)

    // Verify only one block was fetched from the blockstore
    expect(blockstoreGetSpy.callCount).to.equal(1)
  })

  it('can handle dag-scope options with knownDagPath', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    await c.import(reader)

    const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
    const intermediateCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
    const subdagRoot = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')

    const knownDagPath = [dagRoot, intermediateCid, subdagRoot]

    const writer = memoryCarWriter(subdagRoot)
    await c.export(subdagRoot, writer, {
      dagRoot,
      knownDagPath,
      dagScope: DagScope.BLOCK
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([subdagRoot])

    expect(blockstoreGetSpy.getCall(0).args[0]).to.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(2).args[0]).to.equal(knownDagPath[2])

    // With dag-scope=block, no additional traversal should occur after the path
    expect(blockstoreGetSpy.callCount).to.equal(3)

    // Only the path blocks should be in the export
    let blockCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of exportedReader.blocks()) {
      blockCount++
    }
    expect(blockCount).to.equal(3)
  })
})
