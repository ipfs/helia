/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'

const smallFile = Uint8Array.from(new Array(13).fill(0).map(() => Math.random() * 100))

describe('rm', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('refuses to remove files without arguments', async () => {
    // @ts-expect-error invalid args
    await expect(fs.rm()).to.eventually.be.rejected()
  })

  it('removes a file', async () => {
    const path = 'foo'
    const fileCid = await fs.add(smallFile)
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
/*
  describe('with sharding', () => {
    it('recursively removes a sharded directory inside a normal directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const dir = `dir-${Math.random()}`
      const dirPath = `/${dir}`

      await ipfs.files.mkdir(dirPath)

      await ipfs.files.mv(shardedDirPath, dirPath)

      const finalShardedDirPath = `${dirPath}${shardedDirPath}`

      await expect(isShardAtPath(finalShardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(finalShardedDirPath)).type).to.equal('directory')

      await ipfs.files.rm(dirPath, {
        recursive: true
      })

      await expect(ipfs.files.stat(dirPath)).to.eventually.be.rejectedWith(/does not exist/)
      await expect(ipfs.files.stat(shardedDirPath)).to.eventually.be.rejectedWith(/does not exist/)
    })

    it('recursively removes a sharded directory inside a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const otherDirPath = await createShardedDirectory(ipfs)

      await ipfs.files.mv(shardedDirPath, otherDirPath)

      const finalShardedDirPath = `${otherDirPath}${shardedDirPath}`

      await expect(isShardAtPath(finalShardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(finalShardedDirPath)).type).to.equal('directory')
      await expect(isShardAtPath(otherDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(otherDirPath)).type).to.equal('directory')

      await ipfs.files.rm(otherDirPath, {
        recursive: true
      })

      await expect(ipfs.files.stat(otherDirPath)).to.eventually.be.rejectedWith(/does not exist/)
      await expect(ipfs.files.stat(finalShardedDirPath)).to.eventually.be.rejectedWith(/does not exist/)
    })
  })

  it('results in the same hash as a sharded directory created by the importer when removing a file', async function () {
    const {
      nextFile,
      dirWithAllFiles,
      dirWithSomeFiles,
      dirPath
    } = await createTwoShards(ipfs, 1001)

    await ipfs.files.cp(`/ipfs/${dirWithAllFiles}`, dirPath)

    await ipfs.files.rm(nextFile.path)

    const stats = await ipfs.files.stat(dirPath)
    const updatedDirCid = stats.cid

    await expect(isShardAtPath(dirPath, ipfs)).to.eventually.be.true()
    expect((await ipfs.files.stat(dirPath)).type).to.equal('directory')
    expect(updatedDirCid.toString()).to.deep.equal(dirWithSomeFiles.toString())
  })

  it('results in the same hash as a sharded directory created by the importer when removing a subshard', async function () {
    const {
      nextFile,
      dirWithAllFiles,
      dirWithSomeFiles,
      dirPath
    } = await createTwoShards(ipfs, 31)

    await ipfs.files.cp(`/ipfs/${dirWithAllFiles}`, dirPath)

    await ipfs.files.rm(nextFile.path)

    const stats = await ipfs.files.stat(dirPath)
    const updatedDirCid = stats.cid

    await expect(isShardAtPath(dirPath, ipfs)).to.eventually.be.true()
    expect((await ipfs.files.stat(dirPath)).type).to.equal('directory')
    expect(updatedDirCid.toString()).to.deep.equal(dirWithSomeFiles.toString())
  })

  it('results in the same hash as a sharded directory created by the importer when removing a file from a subshard of a subshard', async function () {
    const {
      nextFile,
      dirWithAllFiles,
      dirWithSomeFiles,
      dirPath
    } = await createTwoShards(ipfs, 2187)

    await ipfs.files.cp(`/ipfs/${dirWithAllFiles}`, dirPath)

    await ipfs.files.rm(nextFile.path)

    const stats = await ipfs.files.stat(dirPath)
    const updatedDirCid = stats.cid

    await expect(isShardAtPath(dirPath, ipfs)).to.eventually.be.true()
    expect((await ipfs.files.stat(dirPath)).type).to.equal('directory')
    expect(updatedDirCid.toString()).to.deep.equal(dirWithSomeFiles.toString())
  })

  it('results in the same hash as a sharded directory created by the importer when removing a subshard of a subshard', async function () {
    const {
      nextFile,
      dirWithAllFiles,
      dirWithSomeFiles,
      dirPath
    } = await createTwoShards(ipfs, 139)

    await ipfs.files.cp(`/ipfs/${dirWithAllFiles}`, dirPath)

    await ipfs.files.rm(nextFile.path)

    const stats = await ipfs.files.stat(dirPath)
    const updatedDirCid = stats.cid

    await expect(isShardAtPath(dirPath, ipfs)).to.eventually.be.true()
    expect((await ipfs.files.stat(dirPath)).type).to.equal('directory')
    expect(updatedDirCid.toString()).to.deep.equal(dirWithSomeFiles.toString())
  })
  */
})
