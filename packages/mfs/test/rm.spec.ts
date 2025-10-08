/* eslint-env mocha */

import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { importer } from 'ipfs-unixfs-importer'
import last from 'it-last'
import { mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { createSubShardedDirectory } from './fixtures/create-subsharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { MFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('rm', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    fs = mfs({ blockstore, datastore, logger })
  })

  it('refuses to remove files without arguments', async () => {
    // @ts-expect-error invalid args
    await expect(fs.rm()).to.eventually.be.rejected()
  })

  it('removes a file', async () => {
    const fileName = 'foo.txt'
    const filePath = `/${fileName}`
    await fs.writeBytes(smallFile, filePath)
    await expect(fs.stat(filePath)).to.eventually.be.ok()

    await fs.rm(filePath)

    await expect(fs.stat(filePath)).to.eventually.be.rejected
      .with.property('name', 'DoesNotExistError')
  })

  it('removes a directory', async () => {
    const dirName = 'foo'
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    await fs.rm(dirPath)

    await expect(fs.stat(dirPath)).to.eventually.be.rejected
      .with.property('name', 'DoesNotExistError')
  })

  it('removes a sharded directory inside a normal directory', async () => {
    const dirName = `dir-${Math.random()}`
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = `${dirPath}/sharded-directory`

    await fs.cp(shardedDirCid, shardedDirPath)

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'directory')
    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    await fs.rm(shardedDirPath)

    await expect(fs.stat(shardedDirPath)).to.eventually.be.rejected
      .with.property('name', 'DoesNotExistError')

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'directory')
  })

  it('removes a sharded directory inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-directory'
    await fs.cp(shardedDirCid, shardedDirPath)

    const otherShardedDirCid = await createShardedDirectory(blockstore)
    const shardedSubDir = `subdir-${Math.random()}`
    const shardedSubDirPath = `${shardedDirPath}/${shardedSubDir}`
    await fs.cp(otherShardedDirCid, shardedSubDirPath)

    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    await expect(fs.stat(shardedSubDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    await fs.rm(shardedSubDirPath)

    await expect(fs.stat(shardedSubDirPath)).to.eventually.be.rejected
      .with.property('name', 'DoesNotExistError')

    const shardedDirStats = await fs.stat(shardedDirPath)
    expect(shardedDirStats.cid.toString()).to.equal(shardedDirCid.toString(), 'adding and removing a file from a sharded directory did not result in the original sharded CID')
  })

  it('results in the same hash as a sharded directory created by the importer when removing a file and removing the file means the root node is below the shard threshold', async function () {
    const shardSplitThresholdBytes = 55

    // create a shard with the importer
    const importResult = await last(importer([{
      path: 'file-1.txt',
      content: Uint8Array.from([0, 1, 2, 3, 4])
    }], blockstore, {
      wrapWithDirectory: true,
      shardSplitThresholdBytes
    }))

    if (importResult == null) {
      throw new Error('Nothing imported')
    }

    const { cid: importerCid } = importResult
    await fs.cp(importerCid, '/importer-dir')
    await expect(fs.stat('/importer-dir')).to.eventually.have.nested.property('unixfs.type', 'directory')

    const dirName = 'sharded-dir'
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    // create the same shard with unixfs command
    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), `${dirPath}/file-1.txt`, {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'directory')

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), `${dirPath}/file-2.txt`, {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    await fs.rm(`${dirPath}/file-2.txt`, {
      shardSplitThresholdBytes
    })

    const dirStats = await fs.stat(dirPath)
    expect(dirStats).to.have.nested.property('unixfs.type', 'directory')
    expect(dirStats.cid.toString()).to.equal(importerCid.toString())
  })

  it('results in the same hash as a sharded directory created by the importer when removing a file', async function () {
    const shardSplitThresholdBytes = 1

    // create a shard with the importer
    const importResult = await last(importer([{
      path: 'file-1.txt',
      content: Uint8Array.from([0, 1, 2, 3, 4])
    }], blockstore, {
      wrapWithDirectory: true,
      shardSplitThresholdBytes
    }))

    if (importResult == null) {
      throw new Error('Nothing imported')
    }

    const { cid: importerCid } = importResult
    await fs.cp(importerCid, '/importer-dir')
    await expect(fs.stat('/importer-dir')).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const dirName = 'sharded-dir'
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    // create the same shard with unixfs command
    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), `${dirPath}/file-1.txt`, {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), `${dirPath}/file-2.txt`, {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    await fs.rm(`${dirPath}/file-2.txt`, {
      shardSplitThresholdBytes
    })

    const dirStats = await fs.stat(dirPath)
    expect(dirStats).to.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    expect(dirStats.cid.toString()).to.equal(importerCid.toString())
  })

  it('results in the same hash as a sharded directory created by the importer when removing a sub-shard', async function () {
    const {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubShardedDirectory(blockstore)

    await fs.cp(importerCid, '/importer-dir')
    await expect(fs.stat('/importer-dir')).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const dirName = 'sharded-dir'
    const dirPath = `/${dirName}`
    await fs.cp(containingDirCid, dirPath)

    // remove the file that caused the sub-shard to be created and the CID should be the same as the importer
    await fs.rm(`${dirPath}/${fileName}`, {
      shardSplitThresholdBytes: 1
    })

    // should still be a shard
    const dirStats = await fs.stat(dirPath)
    expect(dirStats)
      .to.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    expect(dirStats.cid.toString()).to.equal(importerCid.toString(), 'removing a file from the imported dir did not result in the same CID')
  })

  it('results in the same hash as a sharded directory created by the importer when removing a sub-shard of a sub-shard', async function () {
    const {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubShardedDirectory(blockstore, 2)

    await fs.cp(importerCid, '/importer-dir')
    await expect(fs.stat('/importer-dir')).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const dirName = 'sharded-dir'
    const dirPath = `/${dirName}`
    await fs.cp(containingDirCid, dirPath)

    // remove the file that caused the sub-shard to be created and the CID should be the same as the importer
    await fs.rm(`${dirPath}/${fileName}`, {
      shardSplitThresholdBytes: 1
    })

    // should still be a shard
    const dirStats = await fs.stat(dirPath)
    expect(dirStats)
      .to.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    expect(dirStats.cid.toString()).to.equal(importerCid.toString(), 'removing a file from the imported dir did not result in the same CID')
  })
})
