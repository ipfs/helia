/* eslint-env mocha */

import { CarReader } from '@ipld/car'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import drain from 'it-drain'
import forEach from 'it-foreach'
import length from 'it-length'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { BlockExporter, SubgraphExporter, UnixFSExporter } from '../src/export-strategies/index.js'
import { car, type Car } from '../src/index.js'
import { GraphSearch, CIDPath, UnixFSPath } from '../src/traversal-strategies/index.js'
import { carEquals, CarEqualsSkip } from './fixtures/car-equals.js'
import { getCodec } from './fixtures/get-codec.js'
import { loadCarFixture } from './fixtures/load-car-fixture.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Blockstore } from 'interface-blockstore'

describe('export', () => {
  let blockstore: Blockstore
  let c: Car
  let blockstoreGetSpy: sinon.SinonSpy

  const dagRoot = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')
  const intermediateCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')
  const subDagRoot = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')
  const multiBlockTxt = CID.parse('bafybeigcisqd7m5nf3qmuvjdbakl5bdnh4ocrmacaqkpuh77qjvggmt2sa')

  beforeEach(async () => {
    blockstore = sinon.spy(new MemoryBlockstore())
    blockstoreGetSpy = blockstore.get as sinon.SinonSpy

    c = car({
      blockstore,
      getCodec,
      logger: defaultLogger()
    })
  })

  it('can export a whole DAG', async () => {
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

  it('can find a sub-DAG using a CID and export it', async () => {
    // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    // import all the blocks from the car file
    await c.import(reader)

    // export the subDag: ipfs://bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu/subdir,
    const writer = memoryCarWriter(intermediateCid)
    await c.export(intermediateCid, writer, {
      traversal: new GraphSearch(intermediateCid)
    })

    const ourCarBytes = await writer.bytes()
    const ourReader = await CarReader.fromBytes(ourCarBytes)

    const roots = await ourReader.getRoots()

    expect(roots).to.deep.equal([intermediateCid])

    await carEquals(ourReader, reader, { skip: [CarEqualsSkip.roots, CarEqualsSkip.header], skipBlocks: [dagRoot] })

    expect(blockstoreGetSpy.callCount).to.equal(9) // 9 blocks in the subDag (dagRoot is not included because we started from intermediateCid)
  })

  it('can use CIDPath to restrain DAG traversal', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const knownDagPath = [dagRoot, intermediateCid, multiBlockTxt]

    const writer = memoryCarWriter(multiBlockTxt)
    await c.export(dagRoot, writer, {
      traversal: new CIDPath(knownDagPath)
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([multiBlockTxt])

    // traversal calls:
    expect(blockstoreGetSpy.getCall(0).args[0]).to.deep.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.deep.equal(knownDagPath[1])

    // exporter calls:
    expect(blockstoreGetSpy.getCall(2).args[0]).to.deep.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(3).args[0]).to.deep.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(4).args[0]).to.deep.equal(knownDagPath[2])
    expect(blockstoreGetSpy.callCount).to.equal(10) // 2 for traversal, 8 for exporter (3 in path, 5 in multiBlockTxt)

    await expect(length(exportedReader.blocks())).to.eventually.equal(8)
  })

  it('can use UnixFSPath to restrain DAG traversal', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const exportedReader = await CarReader.fromIterable(c.stream(dagRoot, {
      traversal: new UnixFSPath('/subdir/multiblock.txt')
    }))

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([dagRoot])

    // traversal calls:
    expect(blockstoreGetSpy.getCall(0).args[0]).to.deep.equal(dagRoot)
    expect(blockstoreGetSpy.getCall(1).args[0]).to.deep.equal(intermediateCid)

    // exporter calls:
    expect(blockstoreGetSpy.getCall(2).args[0]).to.deep.equal(dagRoot)
    expect(blockstoreGetSpy.getCall(3).args[0]).to.deep.equal(intermediateCid)
    expect(blockstoreGetSpy.getCall(4).args[0]).to.deep.equal(multiBlockTxt)
    expect(blockstoreGetSpy.callCount).to.equal(10) // 2 for traversal, 8 for exporter (3 in path, 5 in multiBlockTxt)

    await expect(length(exportedReader.blocks())).to.eventually.equal(8)
  })

  it('can export a single block from a DAG', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const writer = memoryCarWriter(dagRoot)
    await c.export(dagRoot, writer, {
      traversal: new GraphSearch(dagRoot),
      exporter: new BlockExporter()
    })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([dagRoot])

    // only one block (the root) is present in the exported car
    let blockCount = 0

    await drain(forEach(ourReader.blocks(), (block) => {
      blockCount++
      expect(block.cid.toString()).to.equal(dagRoot.toString())
    }))

    expect(blockCount).to.equal(1)
    expect(blockstoreGetSpy.callCount).to.equal(1)
  })

  it('should error on non-UnixFS data with UnixFSExporter', async () => {
    // dag-cbor only blocks in this car file
    const nonUnixFsRoot = CID.parse('bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei')
    // cspell:ignore bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei
    const { reader } = await loadCarFixture('test/fixtures/bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei.car')

    await c.import(reader)

    await expect(c.export(nonUnixFsRoot, memoryCarWriter(nonUnixFsRoot), {
      traversal: new GraphSearch(nonUnixFsRoot),
      exporter: new UnixFSExporter()
    })).to.eventually.be.rejected.with.property('name', 'NotUnixFSError')
  })

  it('can export non-UnixFS data with SubGraphExporter', async () => {
    // dag-cbor only blocks in this car file
    const nonUnixFsRoot = CID.parse('bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei')
    // cspell:ignore bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei
    const { reader } = await loadCarFixture('test/fixtures/bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei.car')

    await c.import(reader)

    const writer = memoryCarWriter(nonUnixFsRoot)

    await c.export(nonUnixFsRoot, writer, {
      traversal: new GraphSearch(nonUnixFsRoot),
      exporter: new SubgraphExporter()
    })

    const ourReader = await CarReader.fromBytes(await writer.bytes())

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([nonUnixFsRoot])

    // For non-UnixFS data, entity should behave like block - only one block should be present
    let blockCount = 0

    await drain(forEach(ourReader.blocks(), (block) => {
      blockCount++
      expect(block.cid.toString()).to.equal(nonUnixFsRoot.toString())
    }))

    expect(blockCount).to.equal(1)
    expect(blockstoreGetSpy.callCount).to.equal(1)
  })

  it('returns only the path blocks with PathStrategy and BlockExporter', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const knownDagPath = [dagRoot, intermediateCid, multiBlockTxt]

    const writer = memoryCarWriter(multiBlockTxt)
    await c.export(dagRoot, writer, {
      traversal: new CIDPath(knownDagPath),
      exporter: new BlockExporter()
    })

    const carData = await writer.bytes()
    const exportedReader = await CarReader.fromBytes(carData)

    const roots = await exportedReader.getRoots()
    expect(roots).to.deep.equal([multiBlockTxt])

    // traversal calls:
    expect(blockstoreGetSpy.getCall(0).args[0]).to.deep.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(1).args[0]).to.deep.equal(knownDagPath[1])

    // exporter calls:
    expect(blockstoreGetSpy.getCall(2).args[0]).to.deep.equal(knownDagPath[0])
    expect(blockstoreGetSpy.getCall(3).args[0]).to.deep.equal(knownDagPath[1])
    expect(blockstoreGetSpy.getCall(4).args[0]).to.deep.equal(knownDagPath[2])

    // with dag-scope=block, no additional traversal should occur after the path
    expect(blockstoreGetSpy.callCount).to.equal(5) // 2 for traversal, 3 (2 from the path, 1 from the multiBlockTxt) for exporter

    // only the path blocks should be in the export
    await expect(length(exportedReader.blocks())).to.eventually.equal(3)
  })

  it('will throw an error when an invalid path is provided to PathStrategy', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    // intermediate cid is not present in the dag nor blockstore.
    const knownDagPath = [dagRoot, CID.parse('bafyreif3tfdpr5n4jdrbielmcapwvbpcthepfkwq2vwonmlhirbjmotedi'), subDagRoot]

    const writer = memoryCarWriter(subDagRoot)
    await expect(c.export(dagRoot, writer, {
      traversal: new CIDPath(knownDagPath)
    })).to.eventually.be.rejectedWith('Not Found')
  })
})
