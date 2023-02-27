/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { CID } from 'multiformats/cid'
import all from 'it-all'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'

describe('ls', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
  })

  it('should require a path', async () => {
    // @ts-expect-error invalid args
    await expect(all(fs.ls())).to.eventually.be.rejected()
  })

  it('lists files in a directory', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.addBytes(data)
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      name: path,
      size: BigInt(data.byteLength),
      type: 'raw'
    }])
  })

  it('lists a file', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.addBytes(data, {
      rawLeaves: false
    })
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid, {
      path
    }))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      size: BigInt(data.byteLength),
      type: 'file'
    }])
  })

  it('lists a raw node', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.addBytes(data)
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid, {
      path
    }))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      size: BigInt(data.byteLength),
      type: 'raw'
    }])
  })

  it('lists a sharded directory contents', async () => {
    const fileCount = 1001
    const shardedDirCid = await createShardedDirectory(blockstore, fileCount)
    const files = await all(fs.ls(shardedDirCid))

    expect(files.length).to.equal(fileCount)

    files.forEach(file => {
      // should be a file
      expect(file.type).to.equal('raw')
    })
  })

  it('lists a file inside a sharded directory directly', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const files = await all(fs.ls(shardedDirCid))
    const fileName = files[0].name

    // should be able to ls new file directly
    const directFiles = await all(fs.ls(shardedDirCid, {
      path: fileName
    }))

    expect(directFiles.length).to.equal(1)
    expect(directFiles.filter(file => file.name === fileName)).to.be.ok()
  })

  it('lists the contents of a directory inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const dirName = `subdir-${Math.random()}`
    const fileName = `small-file-${Math.random()}.txt`

    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 2, 3, 4]))
    const containingDirectoryCid = await fs.cp(fileCid, emptyDirCid, fileName)
    const updatedShardCid = await fs.cp(containingDirectoryCid, shardedDirCid, dirName)

    const files = await all(fs.ls(updatedShardCid, {
      path: dirName
    }))

    expect(files.length).to.equal(1)
    expect(files.filter(file => file.name === fileName)).to.be.ok()
  })
})
