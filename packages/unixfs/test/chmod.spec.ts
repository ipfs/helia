/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { MemoryBlockstore } from 'blockstore-core'
import { UnixFS, unixfs } from '../src/index.js'
import type { CID } from 'multiformats/cid'

const smallFile = Uint8Array.from(new Array(13).fill(0).map(() => Math.random() * 100))

describe('chmod', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('should update the mode for a raw node', async () => {
    const cid = await fs.add(smallFile)
    const originalMode = (await fs.stat(cid)).mode
    const updatedCid = await fs.chmod(cid, 0o777)

    const updatedMode = (await fs.stat(updatedCid)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update the mode for a file', async () => {
    const cid = await fs.add(smallFile, {
      rawLeaves: false
    })
    const originalMode = (await fs.stat(cid)).mode
    const updatedCid = await fs.chmod(cid, 0o777)

    const updatedMode = (await fs.stat(updatedCid)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update the mode for a directory', async () => {
    const path = `foo-${Math.random()}`

    const dirCid = await fs.mkdir(emptyDirCid, path)
    const originalMode = (await fs.stat(dirCid, {
      path
    })).mode
    const updatedCid = await fs.chmod(dirCid, 0o777, {
      path
    })

    const updatedMode = (await fs.stat(updatedCid, {
      path
    })).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update mode recursively', async () => {
    const path = 'path'
    const cid = await fs.add(smallFile)
    const dirCid = await fs.cp(cid, emptyDirCid, path)
    const originalMode = (await fs.stat(dirCid, {
      path
    })).mode
    const updatedCid = await fs.chmod(dirCid, 0o777, {
      recursive: true
    })

    const updatedMode = (await fs.stat(updatedCid, {
      path
    })).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

/*
  it('should update the mode for a hamt-sharded-directory', async () => {
    const path = `/foo-${Math.random()}`

    await ipfs.files.mkdir(path)
    await ipfs.files.write(`${path}/foo.txt`, uint8ArrayFromString('Hello world'), {
      create: true,
      shardSplitThreshold: 0
    })
    const originalMode = (await ipfs.files.stat(path)).mode
    await ipfs.files.chmod(path, '0777', {
      flush: true
    })

    const updatedMode = (await ipfs.files.stat(path)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(parseInt('0777', 8))
  })
  */
})
