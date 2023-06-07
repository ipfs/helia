/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { importer } from 'ipfs-unixfs-importer'
import last from 'it-last'
import { unixfs, type UnixFS } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { createSubshardedDirectory } from './fixtures/create-subsharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('rm', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
  })

  it('refuses to remove files without arguments', async () => {
    // @ts-expect-error invalid args
    await expect(fs.rm()).to.eventually.be.rejected()
  })

  it('removes a file', async () => {
    const path = 'foo'
    const fileCid = await fs.addBytes(smallFile)
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const updatedDirCid = await fs.rm(dirCid, path)

    await expect(fs.stat(updatedDirCid, {
      path
    })).to.eventually.be.rejected
      .with.property('code', 'ERR_DOES_NOT_EXIST')
  })

  it('removes a directory', async () => {
    const path = 'foo'
    const dirCid = await fs.cp(emptyDirCid, emptyDirCid, path)
    const updatedDirCid = await fs.rm(dirCid, path)

    await expect(fs.stat(updatedDirCid, {
      path
    })).to.eventually.be.rejected
      .with.property('code', 'ERR_DOES_NOT_EXIST')
  })

  it('removes a sharded directory inside a normal directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const dirName = `subdir-${Math.random()}`
    const containingDirCid = await fs.cp(shardedDirCid, emptyDirCid, dirName)

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'directory')
    await expect(fs.stat(containingDirCid, {
      path: dirName
    })).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const updatedContainingDirCid = await fs.rm(containingDirCid, dirName)

    await expect(fs.stat(updatedContainingDirCid, {
      path: dirName
    })).to.eventually.be.rejected
      .with.property('code', 'ERR_DOES_NOT_EXIST')
  })

  it('removes a sharded directory inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const otherShardedDirCid = await createShardedDirectory(blockstore)
    const dirName = `subdir-${Math.random()}`
    const containingDirCid = await fs.cp(shardedDirCid, otherShardedDirCid, dirName)

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    await expect(fs.stat(containingDirCid, {
      path: dirName
    })).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const updatedContainingDirCid = await fs.rm(containingDirCid, dirName)

    await expect(fs.stat(updatedContainingDirCid, {
      path: dirName
    })).to.eventually.be.rejected
      .with.property('code', 'ERR_DOES_NOT_EXIST')

    expect(updatedContainingDirCid.toString()).to.equal(shardedDirCid.toString(), 'adding and removing a file from a sharded directory did not result in the original sharded CID')
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
    await expect(fs.stat(importerCid)).to.eventually.have.nested.property('unixfs.type', 'directory')

    // create the same shard with unixfs command
    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
    const containingDirCid = await fs.cp(fileCid, emptyDirCid, 'file-1.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'directory')

    const dirWithFileCid = await fs.cp(fileCid, containingDirCid, 'file-2.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirWithFileCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const dirWithoutFileCid = await fs.rm(dirWithFileCid, 'file-2.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(dirWithoutFileCid)).to.eventually.have.nested.property('unixfs.type', 'directory')

    expect(dirWithoutFileCid).to.eql(importerCid)
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
    await expect(fs.stat(importerCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    // create the same shard with unixfs command
    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
    let containingDirCid = await fs.cp(fileCid, emptyDirCid, 'file-1.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    containingDirCid = await fs.cp(fileCid, containingDirCid, 'file-2.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    containingDirCid = await fs.rm(containingDirCid, 'file-2.txt', {
      shardSplitThresholdBytes
    })

    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    expect(containingDirCid).to.eql(importerCid)
  })

  it('results in the same hash as a sharded directory created by the importer when removing a subshard', async function () {
    const {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubshardedDirectory(blockstore)

    await expect(fs.stat(importerCid))
      .to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    // remove the file that caused the subshard to be created and the CID should be the same as the importer
    const finalDirCid = await fs.rm(containingDirCid, fileName, {
      shardSplitThresholdBytes: 1
    })

    // should still be a shard
    await expect(fs.stat(finalDirCid))
      .to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    expect(finalDirCid).to.eql(importerCid, 'removing a file from the imported dir not result in the same CID')
  })

  it('results in the same hash as a sharded directory created by the importer when removing a subshard of a subshard', async function () {
    let {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubshardedDirectory(blockstore, 2)

    await expect(fs.stat(importerCid))
      .to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    // remove the file that caused the subshard to be created and the CID should be the same as the importer
    containingDirCid = await fs.rm(containingDirCid, fileName, {
      shardSplitThresholdBytes: 1
    })

    await expect(fs.stat(containingDirCid))
      .to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    expect(containingDirCid).to.eql(importerCid)
  })

  it('refuses to rm missing blocks', async () => {
    const cid = await fs.addBytes(smallFile)

    await blockstore.delete(cid)
    expect(blockstore.has(cid)).to.be.false()

    await expect(fs.rm(cid, 'dir', {
      offline: true
    })).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_FOUND')
  })
})
