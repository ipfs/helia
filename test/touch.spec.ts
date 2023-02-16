/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'
import delay from 'delay'
import { importContent, importBytes } from 'ipfs-unixfs-importer'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'

describe('.files.touch', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    const imported = await importContent({ path: 'empty' }, blockstore)
    emptyDirCid = imported.cid
  })

  it('should have default mtime', async () => {
    const { cid } = await importBytes(Uint8Array.from([0, 1, 2, 3, 4]), blockstore)

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
    const seconds = BigInt(Math.floor(mtime.getTime() / 1000))

    const { cid } = await importContent({
      content: Uint8Array.from([0, 1, 2, 3, 4]),
      mtime: {
        secs: seconds
      }
    }, blockstore)

    await delay(2000)
    const updatedCid = await fs.touch(cid)

    await expect(fs.stat(updatedCid)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update directory mtime', async function () {
    this.slow(5 * 1000)
    const path = 'path'
    const mtime = new Date()
    const seconds = BigInt(Math.floor(mtime.getTime() / 1000))

    const cid = await fs.mkdir(emptyDirCid, path, {
      mtime: {
        secs: seconds
      }
    })
    await delay(2000)
    const updateCid = await fs.touch(cid)

    await expect(fs.stat(updateCid)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update mtime recursively', async function () {
    this.slow(5 * 1000)
    const path = 'path'
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)

    const { cid } = await importBytes(Uint8Array.from([0, 1, 2, 3, 4]), blockstore)
    const dirCid = await fs.cp(cid, emptyDirCid, path)

    await delay(2000)

    const updatedCid = await fs.touch(dirCid, {
      recursive: true
    })

    await expect(fs.stat(updatedCid)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)

    await expect(fs.stat(updatedCid, {
      path
    })).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update the mtime for a hamt-sharded-directory', async function () {
    this.slow(5 * 1000)
    const shardedDirCid = await createShardedDirectory(blockstore)
    let updatedShardCid = await fs.touch(shardedDirCid)
    const originalMtime = (await fs.stat(updatedShardCid)).mtime

    if (originalMtime == null) {
      throw new Error('No originalMtime found')
    }

    await delay(2000)
    updatedShardCid = await fs.touch(shardedDirCid)
    const updatedMtime = (await fs.stat(updatedShardCid)).mtime

    if (updatedMtime == null) {
      throw new Error('No updatedMtime found')
    }

    // no bigint support
    expect(updatedMtime.secs).to.satisfy((s: bigint) => s > originalMtime.secs)
  })

  it('should update mtime recursively for a hamt-sharded-directory', async function () {
    this.slow(5 * 1000)
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)
    const shardedDirCid = await createShardedDirectory(blockstore)

    await delay(2000)

    const updatedCid = await fs.touch(shardedDirCid, {
      recursive: true
    })

    await expect(fs.stat(updatedCid)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)

    for await (const file of fs.ls(updatedCid)) {
      expect(file).to.have.nested.property('unixfs.mtime.secs')
        // no bigint support
        .that.satisfies((s: bigint) => s > seconds)
    }
  })
})
