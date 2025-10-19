/* eslint-env mocha */

import { CarReader } from '@ipld/car'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import all from 'it-all'
import drain from 'it-drain'
import forEach from 'it-foreach'
import length from 'it-length'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import sinon from 'sinon'
import { BlockExporter, SubgraphExporter, UnixFSExporter } from '../src/export-strategies/index.js'
import { car } from '../src/index.js'
import { CIDPath, GraphSearch, UnixFSPath } from '../src/traversal-strategies/index.js'
import { carEquals, CarEqualsSkip } from './fixtures/car-equals.js'
import { getCodec } from './fixtures/get-codec.js'
import { loadCarFixture } from './fixtures/load-car-fixture.js'
import type { Car } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('export', () => {
  let blockstore: Blockstore
  let c: Car
  let blockstoreGetSpy: sinon.SinonSpy

  // "/" (1x block)
  const dagRootCid = CID.parse('bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu')

  // "/subdir" (1x block)
  const subdirCid = CID.parse('bafybeicnmple4ehlz3ostv2sbojz3zhh5q7tz5r2qkfdpqfilgggeen7xm')

  // "/subdir/ascii.txt" (1x block)
  const asciiTextCid = CID.parse('bafkreifkam6ns4aoolg3wedr4uzrs3kvq66p4pecirz6y2vlrngla62mxm')

  // "/subdir/hello.txt" (1x block)
  const helloTextCid = CID.parse('bafkreifjjcie6lypi6ny7amxnfftagclbuxndqonfipmb64f2km2devei4')

  // "/subdir/multiblock.txt" (5x blocks)
  const multiBlockTxtCid = CID.parse('bafybeigcisqd7m5nf3qmuvjdbakl5bdnh4ocrmacaqkpuh77qjvggmt2sa')

  const multiBlockTxtCids = [
    CID.parse('bafkreie5noke3mb7hqxukzcy73nl23k6lxszxi5w3dtmuwz62wnvkpsscm'),
    CID.parse('bafkreih4ephajybraj6wnxsbwjwa77fukurtpl7oj7t7pfq545duhot7cq'),
    CID.parse('bafkreigu7buvm3cfunb35766dn7tmqyh2um62zcio63en2btvxuybgcpue'),
    CID.parse('bafkreicll3huefkc3qnrzeony7zcfo7cr3nbx64hnxrqzsixpceg332fhe'),
    CID.parse('bafkreifst3pqztuvj57lycamoi7z34b4emf7gawxs74nwrc2c7jncmpaqm')
  ]

  beforeEach(async () => {
    blockstore = sinon.spy(new MemoryBlockstore())
    blockstoreGetSpy = blockstore.get as sinon.SinonSpy

    c = car({
      blockstore,
      getCodec,
      logger: defaultLogger()
    })
  })

  it('should round-trip fixture CAR file', async () => {
    // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
    const { reader, bytes } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    // import all the blocks from the car file
    await c.import(reader)

    const roots = await reader.getRoots()

    // export the whole dag
    const ourCarBytes = await toBuffer(c.export(roots))

    // should round-trip car bytes
    expect(ourCarBytes).to.equalBytes(bytes)
  })

  it('should export a single block from a DAG', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const ourReader = await CarReader.fromBytes(await toBuffer(c.export(dagRootCid, {
      exporter: new BlockExporter()
    })))

    const roots = await ourReader.getRoots()
    expect(roots).to.deep.equal([dagRootCid])

    // only one block (the root) is present in the exported car
    let blockCount = 0

    await drain(forEach(ourReader.blocks(), (block) => {
      blockCount++
      expect(block.cid.toString()).to.equal(dagRootCid.toString())
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

    await expect(toBuffer(c.export(nonUnixFsRoot, {
      exporter: new UnixFSExporter()
    }))).to.eventually.be.rejected.with.property('name', 'NotUnixFSError')
  })

  it('should export non-UnixFS data with SubGraphExporter', async () => {
    // dag-cbor only blocks in this car file
    const nonUnixFsRoot = CID.parse('bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei')
    // cspell:ignore bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei
    const { reader } = await loadCarFixture('test/fixtures/bafyreieurv3eg6sxth6avdr2zel52mdcqw7dghkljzcnaodb4conrzqjei.car')

    await c.import(reader)

    const ourReader = await CarReader.fromBytes(await toBuffer(c.export(nonUnixFsRoot, {
      exporter: new SubgraphExporter()
    })
    ))

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

  it('should only include root block when block exporter is used', async () => {
    const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

    await c.import(reader)

    const carData = await toBuffer(c.export(multiBlockTxtCid, {
      exporter: new BlockExporter()
    }))
    const exportedReader = await CarReader.fromBytes(carData)

    await expect(exportedReader.getRoots()).to.eventually.deep.equal([
      multiBlockTxtCid
    ])
    await expect(all(exportedReader.cids())).to.eventually.deep.equal([
      multiBlockTxtCid
    ])
  })

  describe('unixfs-exporter', () => {
    it('should export the start of a file', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const exportedReader = await CarReader.fromIterable(c.export(multiBlockTxtCid, {
        exporter: new UnixFSExporter({
          offset: 100,
          length: 10
        })
      }))

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        multiBlockTxtCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        multiBlockTxtCid,
        multiBlockTxtCids[0]
      ])
    })

    it('should export a slice of a file', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const exportedReader = await CarReader.fromIterable(c.export(multiBlockTxtCid, {
        exporter: new UnixFSExporter({
          offset: 600,
          length: 10
        })
      }))

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        multiBlockTxtCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        multiBlockTxtCid,
        multiBlockTxtCids[2]
      ])
    })

    it('should export a slice of a file when later blocks are missing', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      await blockstore.delete(multiBlockTxtCids[3])
      await blockstore.delete(multiBlockTxtCids[4])

      const exportedReader = await CarReader.fromIterable(c.export(multiBlockTxtCid, {
        exporter: new UnixFSExporter({
          offset: 600,
          length: 10
        })
      }))

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        multiBlockTxtCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        multiBlockTxtCid,
        multiBlockTxtCids[2]
      ])
    })

    it('should export a slice of a file when early blocks are missing', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      await blockstore.delete(multiBlockTxtCids[0])
      await blockstore.delete(multiBlockTxtCids[1])

      const exportedReader = await CarReader.fromIterable(c.export(multiBlockTxtCid, {
        exporter: new UnixFSExporter({
          offset: 600,
          length: 10
        })
      }))

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        multiBlockTxtCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        multiBlockTxtCid,
        multiBlockTxtCids[2]
      ])
    })
  })

  describe('graph-search', () => {
    it('should find a sub-DAG using a CID and export it', async () => {
      // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      // import all the blocks from the car file
      await c.import(reader)

      // export just the hello.txt file from the subdir
      const ourCarBytes = await toBuffer(c.export(dagRootCid, {
        traversal: new GraphSearch(helloTextCid)
      }))
      const ourReader = await CarReader.fromBytes(ourCarBytes)

      const roots = await ourReader.getRoots()

      expect(roots).to.deep.equal([dagRootCid])
      await expect(all(ourReader.cids())).to.eventually.deep.equal([
        dagRootCid,
        subdirCid,
        helloTextCid
      ])
    })

    it('should find a sub-DAG using a CID and export it starting from a parent node', async () => {
      // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      // import all the blocks from the car file
      await c.import(reader)

      // search from a parent but start the export from an intermediate node
      const ourCarBytes = await toBuffer(c.export(subdirCid, {
        traversal: new GraphSearch(dagRootCid, helloTextCid),
        includeTraversalBlocks: true
      }))
      const ourReader = await CarReader.fromBytes(ourCarBytes)

      const roots = await ourReader.getRoots()

      expect(roots).to.deep.equal([subdirCid])
      await expect(all(ourReader.cids())).to.eventually.deep.equal([
        dagRootCid,
        subdirCid,
        helloTextCid
      ])
    })
  })

  describe('cid-path', () => {
    it('should use CIDPath to restrain DAG traversal', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const knownDagPath = [dagRootCid, subdirCid, multiBlockTxtCid]

      const carData = await toBuffer(c.export(multiBlockTxtCid, {
        traversal: new CIDPath(knownDagPath)
      }))
      const exportedReader = await CarReader.fromBytes(carData)

      const roots = await exportedReader.getRoots()
      expect(roots).to.deep.equal([multiBlockTxtCid])

      // traversal calls:
      expect(blockstoreGetSpy.getCall(0).args[0]).to.deep.equal(knownDagPath[0])
      expect(blockstoreGetSpy.getCall(1).args[0]).to.deep.equal(knownDagPath[1])

      // exporter calls:
      expect(blockstoreGetSpy.getCall(2).args[0]).to.deep.equal(knownDagPath[2])
      expect(blockstoreGetSpy.callCount).to.equal(9) // 3 for traversal, 6 for exporter (3 in path, 6 in multiBlockTxtCid)

      await expect(length(exportedReader.blocks())).to.eventually.equal(6)
    })

    it('should not include traversal blocks when traversing from a parent node and includeTraversalBlocks is not set', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const knownDagPath = [dagRootCid, subdirCid, helloTextCid]

      const carData = await toBuffer(c.export(helloTextCid, {
        traversal: new CIDPath(knownDagPath),
        exporter: new BlockExporter()
      }))
      const exportedReader = await CarReader.fromBytes(carData)

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        helloTextCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        helloTextCid
      ])
    })

    it('should include traversal blocks when traversing from a parent node and includeTraversalBlocks is set', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const knownDagPath = [dagRootCid, subdirCid, helloTextCid]

      const carData = await toBuffer(c.export(helloTextCid, {
        traversal: new CIDPath(knownDagPath),
        exporter: new BlockExporter(),
        includeTraversalBlocks: true
      }))
      const exportedReader = await CarReader.fromBytes(carData)

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        helloTextCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        dagRootCid,
        subdirCid,
        helloTextCid
      ])
    })

    it('should throw if CID path traversal does not lead to export root', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const knownDagPath = [dagRootCid, subdirCid, multiBlockTxtCid]

      await expect(toBuffer(c.export(helloTextCid, {
        traversal: new CIDPath(knownDagPath)
      }))).to.eventually.be.rejected.with.property('name', 'InvalidTraversalError')
    })

    it('should throw an error when an invalid path is provided to CID path traversal', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      // intermediate cid is not present in the dag
      const knownDagPath = [
        dagRootCid,
        CID.parse('bafyreif3tfdpr5n4jdrbielmcapwvbpcthepfkwq2vwonmlhirbjmotedi'),
        asciiTextCid
      ]

      await expect(toBuffer(c.export(dagRootCid, {
        traversal: new CIDPath(knownDagPath)
      }))).to.eventually.be.rejected.with.property('name', 'NotDescendantError')
    })
  })

  describe('unixfs-path', () => {
    it('should find a sub-DAG using a path and export it', async () => {
      // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      // import all the blocks from the car file
      await c.import(reader)

      // export the subDag: ipfs://bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu/subdir,
      const ourCarBytes = await toBuffer(c.export(subdirCid, {
        traversal: new UnixFSPath(dagRootCid, '/subdir')
      }))
      const ourReader = await CarReader.fromBytes(ourCarBytes)

      const roots = await ourReader.getRoots()

      expect(roots).to.deep.equal([subdirCid])

      await carEquals(ourReader, reader, { skip: [CarEqualsSkip.roots, CarEqualsSkip.header], skipBlocks: [dagRootCid] })

      expect(await length(ourReader.blocks())).to.equal(9)
    })

    it('should export part of a DAG', async () => {
      // cspell:ignore bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      // import all the blocks from the car file
      await c.import(reader)

      // export the subDag: ipfs://bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu/subdir,
      const ourCarBytes = await toBuffer(c.export(dagRootCid, {
        traversal: new UnixFSPath('/subdir/hello.txt')
      }))

      const ourReader = await CarReader.fromBytes(ourCarBytes)
      await expect(ourReader.getRoots()).to.eventually.deep.equal([
        dagRootCid
      ])
      await expect(all(ourReader.cids())).to.eventually.deep.equal([
        dagRootCid,
        subdirCid,
        helloTextCid
      ])
    })

    it('should use UnixFSPath to restrain DAG traversal', async () => {
      const { reader } = await loadCarFixture('test/fixtures/bafybeidh6k2vzukelqtrjsmd4p52cpmltd2ufqrdtdg6yigi73in672fwu.car')

      await c.import(reader)

      const exportedReader = await CarReader.fromIterable(c.export(dagRootCid, {
        // cspell:ignore multiblock
        traversal: new UnixFSPath(dagRootCid, '/subdir/multiblock.txt')
      }))

      await expect(exportedReader.getRoots()).to.eventually.deep.equal([
        dagRootCid
      ])
      await expect(all(exportedReader.cids())).to.eventually.deep.equal([
        dagRootCid,
        subdirCid,
        multiBlockTxtCid,
        ...multiBlockTxtCids
      ])
    })
  })
})
