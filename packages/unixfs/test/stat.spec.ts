/* eslint-env mocha */

import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { unixfs, type UnixFS } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { largeFile, smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('stat', function () {
  this.timeout(120 * 1000)

  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
  })

  it('stats an empty directory', async () => {
    await expect(fs.stat(emptyDirCid, { extended: true })).to.eventually.include({
      size: 0n,
      dagSize: 4n,
      blocks: 1n,
      type: 'directory'
    })
  })

  it('computes how much of the DAG is local', async () => {
    const largeFileCid = await fs.addBytes(largeFile)
    const block = await blockstore.get(largeFileCid)
    const node = dagPb.decode(block)

    expect(node.Links).to.have.lengthOf(5)

    const stats = await fs.stat(largeFileCid, {
      extended: true
    })

    expect(stats.unixfs?.fileSize()).to.equal(5242880n)
    expect(stats.blocks).to.equal(6n)
    expect(stats.dagSize).to.equal(5243139n)
    expect(stats.localSize).to.equal(5242880n)

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    // block count and local file/dag sizes should be smaller
    const updatedStats = await fs.stat(largeFileCid, {
      extended: true,
      offline: true
    })

    expect(updatedStats.unixfs?.fileSize()).to.equal(5242880n)
    expect(updatedStats.blocks).to.equal(5n)
    expect(updatedStats.dagSize).to.equal(4194563n)
    expect(updatedStats.localSize).to.equal(4194304n)
  })

  it('stats a raw node', async () => {
    const fileCid = await fs.addBytes(smallFile)

    const stat = await fs.stat(fileCid)
    expect(stat.type).to.equal('raw')
    expect(stat.size).to.equal(13n)

    const extendedStat = await fs.stat(fileCid, {
      extended: true
    })

    expect(extendedStat).to.deep.equal({
      ...stat,
      blocks: 1n,
      dagSize: BigInt(smallFile.byteLength),
      localSize: BigInt(smallFile.byteLength)
    })
  })

  it('stats a small file', async () => {
    const fileCid = await fs.addBytes(smallFile, {
      cidVersion: 0,
      rawLeaves: false
    })

    const stat = await fs.stat(fileCid)
    expect(stat.type).to.equal('file')
    expect(stat.unixfs?.fileSize()).to.equal(13n)
    expect(stat.size).to.equal(13n)

    const extendedStat = await fs.stat(fileCid, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(1n)
    expect(extendedStat.dagSize).to.equal(21n)
    expect(extendedStat.localSize).to.equal(13n)
    expect(extendedStat.type).to.equal('file')
    expect(extendedStat.unixfs?.fileSize()).to.equal(13n)
    expect(extendedStat.size).to.equal(13n)
  })

  it('stats a large file', async () => {
    const fileCid = await fs.addBytes(largeFile)

    const stat = await fs.stat(fileCid)
    expect(stat.type).to.equal('file')
    expect(stat.unixfs?.fileSize()).to.equal(BigInt(largeFile.length))
    expect(stat.size).to.equal(BigInt(largeFile.length))

    const extendedStat = await fs.stat(fileCid, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(6n)
    expect(extendedStat.dagSize).to.equal(5243139n)
    expect(extendedStat.localSize).to.equal(BigInt(largeFile.length))
    expect(extendedStat.type).to.equal('file')
    expect(extendedStat.unixfs?.fileSize()).to.equal(BigInt(largeFile.length))
    expect(extendedStat.size).to.equal(BigInt(largeFile.length))
  })

  it('should stat file with mode', async () => {
    const mode = 0o644
    const cid = await fs.addFile({
      path: '/foo.txt',
      content: smallFile,
      mode
    })

    await expect(fs.stat(cid, {
      path: 'foo.txt'
    })).to.eventually.include({
      mode
    })
  })

  it('should stat file with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const cid = await fs.addFile({
      path: '/foo.txt',
      content: smallFile,
      mtime
    })

    await expect(fs.stat(cid, {
      path: 'foo.txt'
    })).to.eventually.deep.include({
      mtime
    })
  })

  it('should stat a directory', async function () {
    const stat = await fs.stat(emptyDirCid)
    expect(stat.type).to.equal('directory')

    const extendedStat = await fs.stat(emptyDirCid, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(1n)
    expect(extendedStat.dagSize).to.equal(4n)
    expect(extendedStat.localSize).to.equal(0n)
    expect(extendedStat.type).to.equal('directory')
    expect(extendedStat.size).to.equal(0n)
  })

  it('should stat dir with mode', async function () {
    const mode = 0o755
    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mode
    })

    const stat = await fs.stat(dirCid)
    expect(stat.unixfs?.mode).to.equal(mode)
  })

  it('should stat dir with mtime', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }

    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mtime
    })

    const stat = await fs.stat(dirCid, {
      path
    })

    expect(stat.unixfs?.mtime).to.deep.equal(mtime)
  })

  it('stats a sharded directory', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }
    const shardedDirCid = await createShardedDirectory(blockstore)
    const updatedShardCid = await fs.touch(shardedDirCid, {
      mtime
    })

    const stat = await fs.stat(updatedShardCid)
    expect(stat.type).to.equal('directory')
    expect(stat.unixfs?.type).to.equal('hamt-sharded-directory')

    const extendedStat = await fs.stat(updatedShardCid, {
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
    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3]), {
      rawLeaves: false
    })
    const fileName = `small-file-${Math.random()}.txt`
    const updatedShardCid = await fs.cp(fileCid, shardedDirCid, fileName)

    const stats = await fs.stat(updatedShardCid, {
      path: fileName
    })

    expect(stats.type).to.equal('file')
    expect(stats.unixfs?.fileSize()).to.equal(4n)
  })

  it('refuses to stat missing blocks', async () => {
    const cid = await fs.addBytes(smallFile)

    await blockstore.delete(cid)
    expect(blockstore.has(cid)).to.be.false()

    await expect(fs.stat(cid, {
      offline: true
    })).to.eventually.be.rejected
      .with.property('name', 'NotFoundError')
  })

  it('stats a directory with content', async () => {
    const emptyDirCid = await fs.addDirectory()
    const fileCid = await fs.addBytes(uint8ArrayFromString('Hello World!'))
    const updateDirCid = await fs.cp(fileCid, emptyDirCid, 'foo1.txt')
    const finalDirCid = await fs.cp(fileCid, updateDirCid, 'foo2.txt')

    const stats = await fs.stat(finalDirCid)
    expect(stats.type).to.equal('directory')
    expect(stats.size).to.equal(0n)

    const extendedStat = await fs.stat(finalDirCid, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(3n)
    expect(extendedStat.dagSize).to.equal(132n)
    expect(extendedStat.localSize).to.equal(24n)
    expect(extendedStat.type).to.equal('directory')
    expect(extendedStat.size).to.equal(24n)
  })

  it('stats a directory with content and missing blocks', async () => {
    const emptyDirCid = await fs.addDirectory()
    const fileCid = await fs.addBytes(uint8ArrayFromString('Hello World!'))
    const fileCid2 = await fs.addBytes(uint8ArrayFromString('Hello Universe!'))
    const updateDirCid = await fs.cp(fileCid, emptyDirCid, 'foo1.txt')
    const finalDirCid = await fs.cp(fileCid2, updateDirCid, 'foo2.txt')
    const block = await blockstore.get(finalDirCid)
    const node = dagPb.decode(block)

    const extendedStat = await fs.stat(finalDirCid, {
      extended: true
    })

    expect(extendedStat.blocks).to.equal(3n)
    expect(extendedStat.dagSize).to.equal(135n)
    expect(extendedStat.localSize).to.equal(27n)
    expect(extendedStat.type).to.equal('directory')
    expect(extendedStat.size).to.equal(27n)

    expect(node.Links).to.have.lengthOf(2)

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    const extendedStatMissingBlocks = await fs.stat(finalDirCid, {
      extended: true,
      offline: true
    })

    expect(extendedStatMissingBlocks.blocks).to.equal(2n)
    expect(extendedStatMissingBlocks.dagSize).to.equal(123n)
    expect(extendedStatMissingBlocks.localSize).to.equal(15n)
    expect(extendedStatMissingBlocks.type).to.equal('directory')
    expect(extendedStatMissingBlocks.size).to.equal(15n)
  })
})
