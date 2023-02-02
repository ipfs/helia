/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'
import * as dagPb from '@ipld/dag-pb'

const smallFile = Uint8Array.from(new Array(13).fill(0).map(() => Math.random() * 100))
const largeFile = Uint8Array.from(new Array(490668).fill(0).map(() => Math.random() * 100))

describe('stat', function () {
  this.timeout(120 * 1000)

  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('stats an empty directory', async () => {
    await expect(fs.stat(emptyDirCid)).to.eventually.include({
      fileSize: 0,
      dagSize: 2,
      blocks: 1,
      type: 'directory'
    })
  })

  it('computes how much of the DAG is local', async () => {
    const largeFileCid = await fs.add({ content: largeFile })
    const block = await blockstore.get(largeFileCid)
    const node = dagPb.decode(block)

    expect(node.Links).to.have.lengthOf(2)

    await expect(fs.stat(largeFileCid)).to.eventually.include({
      fileSize: 490668,
      blocks: 3,
      localDagSize: 490776
    })

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    // block count and local file/dag sizes should be smaller
    await expect(fs.stat(largeFileCid)).to.eventually.include({
      fileSize: 490668,
      blocks: 2,
      localFileSize: 228524,
      localDagSize: 228632
    })
  })

  it('stats a raw node', async () => {
    const fileCid = await fs.add({ content: smallFile })

    await expect(fs.stat(fileCid)).to.eventually.include({
      fileSize: smallFile.length,
      dagSize: 13,
      blocks: 1,
      type: 'raw'
    })
  })

  it('stats a small file', async () => {
    const fileCid = await fs.add({ content: smallFile }, {
      cidVersion: 0,
      rawLeaves: false
    })

    await expect(fs.stat(fileCid)).to.eventually.include({
      fileSize: smallFile.length,
      dagSize: 19,
      blocks: 1,
      type: 'file'
    })
  })

  it('stats a large file', async () => {
    const cid = await fs.add({ content: largeFile })

    await expect(fs.stat(cid)).to.eventually.include({
      fileSize: largeFile.length,
      dagSize: 490682,
      blocks: 3,
      type: 'file'
    })
  })

  it('should stat file with mode', async () => {
    const mode = 0o644
    const cid = await fs.add({
      content: smallFile,
      mode
    })

    await expect(fs.stat(cid)).to.eventually.include({
      mode
    })
  })

  it('should stat file with mtime', async function () {
    const mtime = {
      secs: 5,
      nsecs: 0
    }
    const cid = await fs.add({
      content: smallFile,
      mtime
    })

    await expect(fs.stat(cid)).to.eventually.deep.include({
      mtime
    })
  })

  it('should stat a directory', async function () {
    await expect(fs.stat(emptyDirCid)).to.eventually.include({
      type: 'directory',
      blocks: 1,
      fileSize: 0
    })
  })

  it('should stat dir with mode', async function () {
    const mode = 0o755
    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mode
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.include({
      mode
    })
  })

  it('should stat dir with mtime', async function () {
    const mtime = {
      secs: 5,
      nsecs: 0
    }

    const path = 'test-dir'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mtime
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.deep.include({
      mtime
    })
  })
/*
  it('should stat sharded dir with mode', async function () {
    const testDir = `/test-${nanoid()}`

    await ipfs.files.mkdir(testDir, { parents: true })
    await ipfs.files.write(`${testDir}/a`, uint8ArrayFromString('Hello, world!'), {
      create: true,
      shardSplitThreshold: 0
    })

    const stat = await ipfs.files.stat(testDir)

    await expect(isShardAtPath(testDir, ipfs)).to.eventually.be.true()
    expect(stat).to.have.property('type', 'directory')
    expect(stat).to.include({
      mode: 0o755
    })
  })

  it('should stat sharded dir with mtime', async function () {
    const testDir = `/test-${nanoid()}`

    await ipfs.files.mkdir(testDir, {
      parents: true,
      mtime: {
        secs: 5,
        nsecs: 0
      }
    })
    await ipfs.files.write(`${testDir}/a`, uint8ArrayFromString('Hello, world!'), {
      create: true,
      shardSplitThreshold: 0
    })

    const stat = await ipfs.files.stat(testDir)

    await expect(isShardAtPath(testDir, ipfs)).to.eventually.be.true()
    expect(stat).to.have.property('type', 'directory')
    expect(stat).to.deep.include({
      mtime: {
        secs: 5,
        nsecs: 0
      }
    })
  })

  describe('with sharding', () => {
    it('stats a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)

      const stats = await ipfs.files.stat(`${shardedDirPath}`)

      expect(stats.type).to.equal('directory')
      expect(stats.size).to.equal(0)
    })

    it('stats a file inside a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const files = []

      for await (const file of ipfs.files.ls(`${shardedDirPath}`)) {
        files.push(file)
      }

      const stats = await ipfs.files.stat(`${shardedDirPath}/${files[0].name}`)

      expect(stats.type).to.equal('file')
      expect(stats.size).to.equal(7)
    })
  })

  */
})
