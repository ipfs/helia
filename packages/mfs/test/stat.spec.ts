/* eslint-env mocha */

import * as dagPb from '@ipld/dag-pb'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import toBuffer from 'it-to-buffer'
import { mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { largeFile, smallFile } from './fixtures/files.js'
import type { MFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('stat', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    fs = mfs({ blockstore, datastore, logger })
  })

  it('stats an empty directory', async () => {
    const stat = await fs.stat('/')
    expect(stat.type).to.equal('directory')

    const extendedStats = await fs.stat('/', {
      extended: true
    })

    expect(extendedStats.type).to.equal('directory')
    expect(extendedStats.blocks).to.equal(1n)
    expect(extendedStats.dagSize).to.equal(4n)
    expect(extendedStats.localSize).to.equal(0n)
    expect(extendedStats.unixfs?.type).to.equal('directory')
  })

  it('computes how much of the DAG is local', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(largeFile, filePath)

    const stats = await fs.stat(filePath, {
      extended: true
    })

    const block = await toBuffer(blockstore.get(stats.cid))
    const node = dagPb.decode(block)

    expect(node.Links).to.have.lengthOf(5)

    expect(stats.unixfs?.fileSize()).to.equal(5242880n)
    expect(stats.blocks).to.equal(6n)
    expect(stats.dagSize).to.equal(5243139n)
    expect(stats.localSize).to.equal(5242880n)

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    // block count and local file/dag sizes should be smaller
    const updatedStats = await fs.stat(filePath, {
      extended: true,
      offline: true
    })

    expect(updatedStats.unixfs?.fileSize()).to.equal(5242880n)
    expect(updatedStats.blocks).to.equal(5n)
    expect(updatedStats.dagSize).to.equal(4194563n)
    expect(updatedStats.localSize).to.equal(4194304n)
  })

  it('stats a raw node', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath)

    const stat = await fs.stat(filePath)
    expect(stat.type).to.equal('raw')
    expect(stat.size).to.equal(13n)

    const extendedStat = await fs.stat(filePath, {
      extended: true
    })

    expect(extendedStat).to.deep.equal({
      ...stat,
      blocks: 1n,
      dagSize: BigInt(smallFile.byteLength),
      localSize: BigInt(smallFile.byteLength),
      uniqueBlocks: 1n,
      deduplicatedDagSize: BigInt(smallFile.byteLength)
    })
  })

  it('stats a small file', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath, {
      cidVersion: 0,
      rawLeaves: false
    })

    const stat = await fs.stat(filePath)
    expect(stat.type).to.equal('file')
    expect(stat.unixfs?.fileSize()).to.equal(13n)

    const extendedStat = await fs.stat(filePath, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(1n)
    expect(extendedStat.dagSize).to.equal(21n)
    expect(extendedStat.localSize).to.equal(13n)
    expect(extendedStat.type).to.equal('file')
    expect(extendedStat.unixfs?.fileSize()).to.equal(13n)
  })

  it('stats a large file', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(largeFile, filePath)

    const stat = await fs.stat(filePath)
    expect(stat.type).to.equal('file')
    expect(stat.unixfs?.fileSize()).to.equal(BigInt(largeFile.length))

    const extendedStat = await fs.stat(filePath, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(6n)
    expect(extendedStat.dagSize).to.equal(5243139n)
    expect(extendedStat.localSize).to.equal(BigInt(largeFile.length))
    expect(extendedStat.type).to.equal('file')
    expect(extendedStat.unixfs?.fileSize()).to.equal(BigInt(largeFile.length))
  })

  it('should stat file with mode', async () => {
    const mode = 0o644
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath, {
      mode
    })

    const stat = await fs.stat(filePath)
    expect(stat.unixfs?.mode).to.equal(mode)
  })

  it('should stat file with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath, {
      mtime
    })

    const stat = await fs.stat(filePath)
    expect(stat.unixfs?.mtime).to.deep.equal(mtime)
  })

  it('should stat a directory', async function () {
    const stat = await fs.stat('/')
    expect(stat.type).to.equal('directory')

    const extendedStat = await fs.stat('/', {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(1n)
    expect(extendedStat.dagSize).to.equal(4n)
    expect(extendedStat.localSize).to.equal(0n)
    expect(extendedStat.type).to.equal('directory')
  })

  it('should stat dir with mode', async function () {
    const mode = 0o755
    const path = '/test-dir'
    await fs.mkdir(path, {
      mode
    })

    const stat = await fs.stat(path)
    expect(stat.unixfs?.mode).to.equal(mode)
  })

  it('should stat dir with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }

    const path = '/test-dir'
    await fs.mkdir(path, {
      mtime
    })

    const stat = await fs.stat(path)
    expect(stat.unixfs?.mtime).to.deep.equal(mtime)
  })

  it('stats a sharded directory', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-directory'
    await fs.cp(shardedDirCid, shardedDirPath)

    await fs.touch(shardedDirPath, {
      mtime
    })

    const stat = await fs.stat(shardedDirPath)
    expect(stat.type).to.equal('directory')
    expect(stat.unixfs?.type).to.equal('hamt-sharded-directory')

    const extendedStat = await fs.stat(shardedDirPath, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(1243n)
    expect(extendedStat.dagSize).to.equal(79157n)
    expect(extendedStat.localSize).to.equal(5005n)
    expect(extendedStat.type).to.equal('directory')
    expect(extendedStat.unixfs?.type).to.equal('hamt-sharded-directory')
  })

  it('stats a file inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-directory'
    await fs.cp(shardedDirCid, shardedDirPath)

    const filePath = `${shardedDirPath}/file-inside-sharded-dir.txt`

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3]), filePath, {
      rawLeaves: false
    })

    const stats = await fs.stat(filePath)
    expect(stats.unixfs?.fileSize()).to.equal(4n)
  })
})
