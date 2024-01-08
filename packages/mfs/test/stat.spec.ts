/* eslint-env mocha */

import * as dagPb from '@ipld/dag-pb'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { type MFS, mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { largeFile, smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('stat', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()

    fs = mfs({ blockstore, datastore })
  })

  it('stats an empty directory', async () => {
    await expect(fs.stat('/')).to.eventually.include({
      fileSize: 0n,
      dagSize: 2n,
      blocks: 1,
      type: 'directory'
    })
  })

  it('computes how much of the DAG is local', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(largeFile, filePath)

    const stats = await fs.stat(filePath)

    const block = await blockstore.get(stats.cid)
    const node = dagPb.decode(block)

    expect(node.Links).to.have.lengthOf(5)

    expect(stats).to.include({
      fileSize: 5242880n,
      blocks: 6,
      localDagSize: 5243139n
    })

    // remove one of the blocks so we now have an incomplete DAG
    await blockstore.delete(node.Links[0].Hash)

    // block count and local file/dag sizes should be smaller
    await expect(fs.stat(filePath)).to.eventually.include({
      fileSize: 5242880n,
      blocks: 5,
      localFileSize: 4194304n,
      localDagSize: 4194563n
    })
  })

  it('stats a raw node', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath)

    await expect(fs.stat(filePath)).to.eventually.include({
      fileSize: BigInt(smallFile.length),
      dagSize: 13n,
      blocks: 1,
      type: 'raw'
    })
  })

  it('stats a small file', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath, {
      cidVersion: 0,
      rawLeaves: false
    })

    await expect(fs.stat(filePath)).to.eventually.include({
      fileSize: BigInt(smallFile.length),
      dagSize: 19n,
      blocks: 1,
      type: 'file'
    })
  })

  it('stats a large file', async () => {
    const filePath = '/foo.txt'
    await fs.writeBytes(largeFile, filePath)

    await expect(fs.stat(filePath)).to.eventually.include({
      fileSize: BigInt(largeFile.length),
      dagSize: 5242907n,
      blocks: 6,
      type: 'file'
    })
  })

  it('should stat file with mode', async () => {
    const mode = 0o644
    const filePath = '/foo.txt'
    await fs.writeBytes(smallFile, filePath, {
      mode
    })

    await expect(fs.stat(filePath)).to.eventually.include({
      mode
    })
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

    await expect(fs.stat(filePath)).to.eventually.deep.include({
      mtime
    })
  })

  it('should stat a directory', async function () {
    await expect(fs.stat('/')).to.eventually.include({
      type: 'directory',
      blocks: 1,
      fileSize: 0n
    })
  })

  it('should stat dir with mode', async function () {
    const mode = 0o755
    const path = '/test-dir'
    await fs.mkdir(path, {
      mode
    })

    await expect(fs.stat(path)).to.eventually.include({
      mode
    })
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

    await expect(fs.stat(path)).to.eventually.deep.include({
      mtime
    })
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
    expect(stat).to.have.property('type', 'directory')
    expect(stat).to.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    expect(stat).to.include({
      mode: 0o755
    })
    expect(stat).to.deep.include({
      mtime
    })
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
    expect(stats.type).to.equal('file')
    expect(stats.fileSize).to.equal(4n)
  })
})
