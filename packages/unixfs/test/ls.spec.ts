/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { CID } from 'multiformats/cid'
import all from 'it-all'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'

describe('ls', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('should require a path', async () => {
    // @ts-expect-error invalid args
    await expect(all(fs.ls())).to.eventually.be.rejected()
  })

  it('lists files in a directory', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.add(data)
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      name: path,
      size: data.byteLength,
      type: 'raw'
    }])
  })

  it('lists a file', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.add(data, {
      rawLeaves: false
    })
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid, {
      path
    }))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      size: data.byteLength,
      type: 'file'
    }])
  })

  it('lists a raw node', async () => {
    const path = 'path'
    const data = Uint8Array.from([0, 1, 2, 3])
    const fileCid = await fs.add(data)
    const dirCid = await fs.cp(fileCid, emptyDirCid, path)
    const files = await all(fs.ls(dirCid, {
      path
    }))

    expect(files).to.have.lengthOf(1).and.to.containSubset([{
      cid: fileCid,
      size: data.byteLength,
      type: 'raw'
    }])
  })

  /*
  describe('with sharding', () => {
    it('lists a sharded directory contents', async () => {
      const fileCount = 1001
      const dirPath = await createShardedDirectory(ipfs, fileCount)
      const files = await all(ipfs.files.ls(dirPath))

      expect(files.length).to.equal(fileCount)

      files.forEach(file => {
        // should be a file
        expect(file.type).to.equal('file')
      })
    })

    it('lists a file inside a sharded directory directly', async () => {
      const dirPath = await createShardedDirectory(ipfs)
      const files = await all(ipfs.files.ls(dirPath))
      const filePath = `${dirPath}/${files[0].name}`

      // should be able to ls new file directly
      const file = await all(ipfs.files.ls(filePath))

      expect(file).to.have.lengthOf(1).and.to.containSubset([files[0]])
    })

    it('lists the contents of a directory inside a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const dirPath = `${shardedDirPath}/subdir-${Math.random()}`
      const fileName = `small-file-${Math.random()}.txt`

      await ipfs.files.mkdir(`${dirPath}`)
      await ipfs.files.write(`${dirPath}/${fileName}`, Uint8Array.from([0, 1, 2, 3]), {
        create: true
      })

      const files = await all(ipfs.files.ls(dirPath))

      expect(files.length).to.equal(1)
      expect(files.filter(file => file.name === fileName)).to.be.ok()
    })
  })
  */
})
