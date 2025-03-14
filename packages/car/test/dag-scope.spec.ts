/* eslint-env mocha */

import { CarReader } from '@ipld/car'
import { expect } from 'aegir/chai'
import loadFixtures from 'aegir/fixtures'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { car, type Car } from '../src/index.js'
import { getCodec } from './fixtures/get-codec.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('dag-scope', () => {
  let blockstore: Blockstore
  let c: Car

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

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

  it('can use knownDagPath to optimize export', async () => {
    const carBytes = loadFixtures('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    const carBytesAsUint8Array = new Uint8Array(carBytes)
    const reader = await CarReader.fromBytes(carBytesAsUint8Array)

    // Import all the blocks from the car file
    await c.import(reader)

    // Get all the CIDs in the CAR file
    const allCids: CID[] = []
    for await (const block of reader.blocks()) {
      allCids.push(block.cid)
    }

    // Select the root and a subdag CID
    const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
    const intermediateCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
    const subdagRoot = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')

    // Create a known path
    const knownDagPath = [dagRoot, intermediateCid, subdagRoot]

    // Replace the blockstore.get method with a spy to track calls
    const originalGet = blockstore.get
    const getCalls: CID[] = []

    // Mock the blockstore.get method to track calls
    blockstore.get = async function (cid: CID, ...args: any[]): Promise<Uint8Array> {
      getCalls.push(cid)
      return originalGet.call(this, cid, ...args)
    }

    try {
      // Export using knownDagPath
      const writer = memoryCarWriter(subdagRoot)
      await c.export(subdagRoot, writer, {
        dagRoot,
        knownDagPath
      })

      // Create the CAR
      const carData = await writer.bytes()
      const exportedReader = await CarReader.fromBytes(carData)

      // Verify the exported CAR contains the correct roots
      const roots = await exportedReader.getRoots()
      expect(roots).to.deep.equal([subdagRoot])

      // In a real-world scenario with a non-trivial DAG, we would verify
      // that the path-finding process didn't make unnecessary blockstore.get
      // calls for every block on the path from dagRoot to subdagRoot

      // Verify that only CIDs in knownDagPath were retrieved directly
      const pathCidStrings = knownDagPath.map(cid => cid.toString())
      const directGetCalls = getCalls.filter(cid => pathCidStrings.includes(cid.toString()))

      // Assert that the direct get calls match our known path
      expect(directGetCalls.length).to.equal(knownDagPath.length)
    } finally {
      // Restore the original method
      blockstore.get = originalGet
    }
  })
})
