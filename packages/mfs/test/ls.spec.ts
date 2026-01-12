/* eslint-env mocha */

import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import all from 'it-all'
import { mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import type { MFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('ls', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    fs = mfs({ blockstore, datastore, logger })
  })

  it('should list mfs root by default', async () => {
    await expect(all(fs.ls())).to.eventually.have.lengthOf(0)
  })

  it('lists files in the root directory', async () => {
    const fileName = 'foo.txt'
    const filePath = `/${fileName}`
    const data = Uint8Array.from([0, 1, 2, 3])
    await fs.writeBytes(data, filePath)
    const fileStat = await fs.stat(filePath)
    const files = await all(fs.ls('/'))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileStat.cid,
      name: fileName,
      path: filePath
    }])
  })

  it('lists files in a directory', async () => {
    const dirName = 'bar'
    const dirPath = `/${dirName}`
    const fileName = 'foo.txt'
    const filePath = `${dirPath}/${fileName}`
    const data = Uint8Array.from([0, 1, 2, 3])
    await fs.writeBytes(data, filePath, {
      force: true
    })
    const fileStat = await fs.stat(filePath)
    const files = await all(fs.ls(dirPath))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileStat.cid,
      name: fileName,
      path: filePath
    }])
  })

  it('lists a file', async () => {
    const dirName = 'bar'
    const dirPath = `/${dirName}`
    const fileName = 'foo.txt'
    const filePath = `${dirPath}/${fileName}`
    const data = Uint8Array.from([0, 1, 2, 3])
    await fs.writeBytes(data, filePath, {
      rawLeaves: false,
      force: true
    })
    const fileStat = await fs.stat(filePath)
    const files = await all(fs.ls(filePath))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileStat.cid,
      size: BigInt(data.byteLength),
      type: 'file'
    }])
  })

  it('lists a file in a directory', async () => {
    const dirName = 'bar'
    const dirPath = `/${dirName}`
    const fileName = 'foo.txt'
    const filePath = `${dirPath}/${fileName}`
    const data = Uint8Array.from([0, 1, 2, 3])
    await fs.writeBytes(data, filePath, {
      rawLeaves: false,
      force: true
    })
    const fileStat = await fs.stat(filePath)
    const files = await all(fs.ls(dirPath, {
      path: fileName
    }))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileStat.cid,
      size: BigInt(data.byteLength),
      type: 'file'
    }])
  })

  it('lists a raw node', async () => {
    const dirName = 'bar'
    const dirPath = `/${dirName}`
    const fileName = 'foo.txt'
    const filePath = `${dirPath}/${fileName}`
    const data = Uint8Array.from([0, 1, 2, 3])
    await fs.writeBytes(data, filePath, {
      force: true,
      rawLeaves: true
    })
    const fileStat = await fs.stat(filePath)
    const files = await all(fs.ls(dirPath))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileStat.cid,
      name: fileName,
      path: filePath
    }])
  })

  it('lists sharded directory contents', async () => {
    const shardedDirPath = '/sharded-dir'
    const fileCount = 1001
    const shardedDirCid = await createShardedDirectory(blockstore, fileCount)
    await fs.cp(shardedDirCid, shardedDirPath)
    const files = await all(fs.ls(shardedDirPath))

    expect(files.length).to.equal(fileCount)

    for (const entry of files) {
      const file = await fs.stat(entry.path)

      // should be a file
      expect(file.type).to.equal('raw')
    }
  })

  it('lists a file inside a sharded directory directly', async () => {
    const shardedDirPath = '/sharded-dir'
    const fileCount = 1001
    const shardedDirCid = await createShardedDirectory(blockstore, fileCount)
    await fs.cp(shardedDirCid, shardedDirPath)
    const files = await all(fs.ls(shardedDirPath))
    const fileName = files[0].name

    // should be able to ls new file directly
    const directFiles = await all(fs.ls(shardedDirPath, {
      path: fileName
    }))

    expect(directFiles.length).to.equal(1)
    expect(directFiles.filter(file => file.name === fileName)).to.be.ok()
  })

  it('lists the contents of a directory inside a sharded directory', async () => {
    const shardedDirPath = '/sharded-dir'
    const shardedDirCid = await createShardedDirectory(blockstore)
    await fs.cp(shardedDirCid, shardedDirPath)

    const dirName = `subdir-${Math.random()}`
    const fileName = `small-file-${Math.random()}.txt`

    const filePath = `${shardedDirPath}/${dirName}/${fileName}`

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), filePath, {
      force: true
    })

    const files = await all(fs.ls(shardedDirPath, {
      path: dirName
    }))

    expect(files.length).to.equal(1)
    expect(files.filter(file => file.name === fileName)).to.be.ok()
  })
})
