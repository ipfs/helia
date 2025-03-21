/* eslint-env mocha */

import { CarReader } from '@ipld/car'
import { expect } from 'aegir/chai'
import loadFixtures from 'aegir/fixtures'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { car, type Car } from '../src/index.js'
import { carEquals, CarEqualsSkip } from './fixtures/car-equals.js'
import { getCodec } from './fixtures/get-codec.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('dag-scope', () => {
  let blockstore: Blockstore
  let c: Car
  let blockstoreGetSpy: sinon.SinonSpy

  const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
  const intermediateCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
  const subDagRoot = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')

  async function loadCarFixture (path: string): Promise<{ reader: CarReader, bytes: Uint8Array }> {
    const carBytes = loadFixtures(path)
    const carBytesAsUint8Array = new Uint8Array(carBytes)
    return {
      reader: await CarReader.fromBytes(carBytesAsUint8Array),
      bytes: carBytesAsUint8Array
    }
  }

  beforeEach(async () => {
    blockstore = sinon.spy(new MemoryBlockstore())
    blockstoreGetSpy = blockstore.get as sinon.SinonSpy

    c = car({ blockstore, getCodec })
  })

  it('generates a proper car file with dag-scope=all', async () => {
    const { reader, bytes: carBytes } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')
    const roots = await reader.getRoots()

    await c.import(reader)

    // export a car file, and ensure the car file is the same as the original
    const writer = memoryCarWriter(roots)
    await c.export(roots, writer)
    const ourCarBytes = await writer.bytes()

    const ourReader = await CarReader.fromBytes(ourCarBytes)

    await carEquals(ourReader, reader)

    expect(ourCarBytes.length).to.equal(carBytes.length)

    expect(blockstoreGetSpy.callCount).to.equal(10) // 10 blocks in the subDag
  })

  it('can generate a proper dag-scope=all car for a subDag', async () => {
    // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    // import all the blocks from the car file
    await c.import(reader)

    // export the subDag: ipfs://bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu/subdir,
    const writer = memoryCarWriter(intermediateCid)
    await c.export(intermediateCid, writer, { dagRoot })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()

    expect(roots).to.deep.equal([intermediateCid])

    await carEquals(ourReader, reader, { skip: [CarEqualsSkip.roots, CarEqualsSkip.header] })

    expect(blockstoreGetSpy.callCount).to.equal(10) // 10 blocks in the subDag
  })

  it('can use knownDagPath to optimize car export', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const knownDagPath = [dagRoot, intermediateCid, subDagRoot]

    const writer = memoryCarWriter(subDagRoot)
    await c.export(subDagRoot, writer, {
      dagRoot,
      knownDagPath
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([subDagRoot])

    expect(blockstoreGetSpy.getCall(0).args[0]).to.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(2).args[0]).to.equal(knownDagPath[2])
    expect(blockstoreGetSpy.callCount).to.equal(3)
  })

  it('can generate a car file with dag-scope=block', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const writer = memoryCarWriter(dagRoot)
    await c.export(dagRoot, writer, { dagScope: 'block' })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([dagRoot])

    // only one block (the root) is present in the exported car
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
    // cspell:ignore bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei
    const nonUnixFsRoot = CID.parse('bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei')
    const { reader } = await loadCarFixture('test/fixtures/bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei.car')

    await c.import(reader)

    const writer = memoryCarWriter(nonUnixFsRoot)
    await c.export(nonUnixFsRoot, writer, { dagScope: 'entity' })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([nonUnixFsRoot])

    // For non-UnixFS data, entity should behave like block - only one block should be present
    let blockCount = 0
    for await (const block of ourReader.blocks()) {
      blockCount++
      expect(block.cid.toString()).to.equal(nonUnixFsRoot.toString())
    }
    expect(blockCount).to.equal(1)

    expect(blockstoreGetSpy.callCount).to.equal(1)
  })

  it('can handle dag-scope options with knownDagPath', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const knownDagPath = [dagRoot, intermediateCid, subDagRoot]

    const writer = memoryCarWriter(subDagRoot)
    await c.export(subDagRoot, writer, {
      dagRoot,
      knownDagPath,
      dagScope: 'block'
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([subDagRoot])

    expect(blockstoreGetSpy.getCall(0).args[0]).to.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(2).args[0]).to.equal(knownDagPath[2])

    // with dag-scope=block, no additional traversal should occur after the path
    expect(blockstoreGetSpy.callCount).to.equal(3)

    // only the path blocks should be in the export
    let blockCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of exportedReader.blocks()) {
      blockCount++
    }
    expect(blockCount).to.equal(3)
  })

  it('errors when a block in knownDagPath is not in blockstore', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    // intermediate cid is not present in the dag nor blockstore.
    const knownDagPath = [dagRoot, CID.parse('bafyreif3tfdpr5n4jdrbielmcapwvbpcthepfkwq2vwonmlhirbjmotedi'), subDagRoot]

    const writer = memoryCarWriter(subDagRoot)
    await expect(c.export(subDagRoot, writer, {
      dagRoot,
      knownDagPath
    })).to.eventually.be.rejectedWith('CID in knownDagPath at index 1 not found in blockstore')
  })
})
