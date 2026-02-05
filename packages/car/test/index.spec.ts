import { mfs } from '@helia/mfs'
import { unixfs } from '@helia/unixfs'
import { CarReader } from '@ipld/car'
import { defaultLogger } from '@libp2p/logger'
import { createScalableCuckooFilter } from '@libp2p/utils'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import toBuffer from 'it-to-buffer'
import { car } from '../src/index.js'
import { largeFile, smallFile } from './fixtures/files.js'
import { getCodec } from './fixtures/get-codec.js'
import type { Car } from '../src/index.js'
import type { UnixFS } from '@helia/unixfs'
import type { Blockstore } from 'interface-blockstore'

describe('import/export car file', () => {
  let blockstore: Blockstore
  let c: Car
  let u: UnixFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    c = car({
      blockstore,
      getCodec,
      logger: defaultLogger()
    })
    u = unixfs({ blockstore })
  })

  it('exports and imports a car file', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })
    const cid = await otherUnixFS.addBytes(smallFile)
    const bytes = await toBuffer(otherCar.export(cid))
    const reader = await CarReader.fromBytes(bytes)

    await c.import(reader)

    expect(await toBuffer(blockstore.get(cid))).to.equalBytes(smallFile)
  })

  it('exports and imports a multiple root car file', async () => {
    const fileData1 = Uint8Array.from([0, 1, 2, 3])
    const fileData2 = Uint8Array.from([4, 5, 6, 7])
    const fileData3 = Uint8Array.from([8, 9, 0, 1])

    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })
    const cid1 = await otherUnixFS.addBytes(fileData1)
    const cid2 = await otherUnixFS.addBytes(fileData2)
    const cid3 = await otherUnixFS.addBytes(fileData3)
    const bytes = await toBuffer(otherCar.export([cid1, cid2, cid3]))
    const reader = await CarReader.fromBytes(bytes)

    await c.import(reader)

    expect(await toBuffer(u.cat(cid1))).to.equalBytes(fileData1)
    expect(await toBuffer(u.cat(cid2))).to.equalBytes(fileData2)
    expect(await toBuffer(u.cat(cid3))).to.equalBytes(fileData3)
  })

  it('exports and imports a multiple block car file', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })
    const cid = await otherUnixFS.addBytes(largeFile)
    const bytes = await toBuffer(otherCar.export(cid))
    const reader = await CarReader.fromBytes(bytes)

    await c.import(reader)

    expect(await toBuffer(u.cat(cid))).to.equalBytes(largeFile)
  })

  it('exports and imports a multiple block, multiple root car file', async () => {
    const fileData1 = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7])
    const fileData2 = Uint8Array.from([4, 5, 6, 7, 8, 9, 0, 1])
    const fileData3 = Uint8Array.from([8, 9, 0, 1, 2, 3, 4, 5])

    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })
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

    const bytes = await toBuffer(otherCar.export([cid1, cid2, cid3]))
    const reader = await CarReader.fromBytes(bytes)

    await c.import(reader)

    expect(await toBuffer(u.cat(cid1))).to.equalBytes(fileData1)
    expect(await toBuffer(u.cat(cid2))).to.equalBytes(fileData2)
    expect(await toBuffer(u.cat(cid3))).to.equalBytes(fileData3)
  })

  it('exports a car file without duplicates', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherDatastore = new MemoryDatastore()
    const otherMFS = mfs({ blockstore: otherBlockstore, datastore: otherDatastore, logger: defaultLogger() })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })

    await otherMFS.mkdir('/testDuplicates')
    await otherMFS.mkdir('/testDuplicates/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDuplicates/a.small-file')
    await otherMFS.cp(sourceCid, '/testDuplicates/sub/b.small-file')

    const rootObject = await otherMFS.stat('/testDuplicates/')
    const rootCid = rootObject.cid

    const blockFilter = createScalableCuckooFilter(5)

    const carBytes = await toBuffer(otherCar.export(rootCid, {
      blockFilter
    }))

    expect(carBytes.length).to.equal(351)
  })

  it('exports a car file with duplicates', async () => {
    const otherBlockstore = new MemoryBlockstore()
    const otherUnixFS = unixfs({ blockstore: otherBlockstore })
    const otherDatastore = new MemoryDatastore()
    const otherMFS = mfs({ blockstore: otherBlockstore, datastore: otherDatastore, logger: defaultLogger() })
    const otherCar = car({ blockstore: otherBlockstore, getCodec, logger: defaultLogger() })

    await otherMFS.mkdir('/testDuplicates')
    await otherMFS.mkdir('/testDuplicates/sub')

    const sourceCid = await otherUnixFS.addBytes(smallFile)
    await otherMFS.cp(sourceCid, '/testDuplicates/a.small-file')
    await otherMFS.cp(sourceCid, '/testDuplicates/sub/b.small-file')

    const rootObject = await otherMFS.stat('/testDuplicates/')
    const rootCid = rootObject.cid

    const carBytes = await toBuffer(otherCar.export(rootCid))
    expect(carBytes.length).to.equal(401)
  })
})
