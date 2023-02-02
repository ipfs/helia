/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'
import delay from 'delay'

describe('.files.touch', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('should have default mtime', async () => {
    const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))

    await expect(fs.stat(cid)).to.eventually.have.property('mtime')
      .that.is.undefined()

    const updatedCid = await fs.touch(cid)

    await expect(fs.stat(updatedCid)).to.eventually.have.property('mtime')
      .that.is.not.undefined().and.does.not.deep.equal({
        secs: 0,
        nsecs: 0
      })
  })

  it('should update file mtime', async function () {
    this.slow(5 * 1000)
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)

    const cid = await fs.add({
      content: Uint8Array.from([0, 1, 2, 3, 4]),
      mtime: {
        secs: seconds
      }
    })

    await delay(2000)
    const updatedCid = await fs.touch(cid)

    await expect(fs.stat(updatedCid)).to.eventually.have.nested.property('mtime.secs')
      .that.is.greaterThan(seconds)
  })

  it('should update directory mtime', async function () {
    this.slow(5 * 1000)
    const path = 'path'
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)

    const cid = await fs.mkdir(emptyDirCid, path, {
      mtime: {
        secs: seconds
      }
    })
    await delay(2000)
    const updateCid = await fs.touch(cid)

    await expect(fs.stat(updateCid)).to.eventually.have.nested.property('mtime.secs')
      .that.is.greaterThan(seconds)
  })

  it('should update mtime recursively', async function () {
    this.slow(5 * 1000)
    const path = 'path'
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)

    const cid = await fs.add(Uint8Array.from([0, 1, 2, 3, 4]))
    const dirCid = await fs.cp(cid, emptyDirCid, path)

    await delay(2000)

    const updatedCid = await fs.touch(dirCid, {
      recursive: true
    })

    await expect(fs.stat(updatedCid)).to.eventually.have.nested.property('mtime.secs')
      .that.is.greaterThan(seconds)

    await expect(fs.stat(updatedCid, {
      path
    })).to.eventually.have.nested.property('mtime.secs')
      .that.is.greaterThan(seconds)
  })
/*
  it('should update the mtime for a hamt-sharded-directory', async () => {
    const path = `/foo-${Math.random()}`

    await ipfs.files.mkdir(path, {
      mtime: new Date()
    })
    await ipfs.files.write(`${path}/foo.txt`, uint8ArrayFromString('Hello world'), {
      create: true,
      shardSplitThreshold: 0
    })
    const originalMtime = (await ipfs.files.stat(path)).mtime

    if (!originalMtime) {
      throw new Error('No originalMtime found')
    }

    await delay(1000)
    await ipfs.files.touch(path, {
      flush: true
    })

    const updatedMtime = (await ipfs.files.stat(path)).mtime

    if (!updatedMtime) {
      throw new Error('No updatedMtime found')
    }

    expect(updatedMtime.secs).to.be.greaterThan(originalMtime.secs)
  })
*/
})
