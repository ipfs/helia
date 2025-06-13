/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import delay from 'delay'
import { mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import type { MFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('touch', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()

    fs = mfs({ blockstore, datastore })
  })

  it('should have default mtime', async () => {
    const path = '/foo.txt'
    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), path)

    await expect(fs.stat(path)).to.eventually.have.property('mtime')
      .that.is.undefined()

    await fs.touch(path)

    await expect(fs.stat(path)).to.eventually.have.property('mtime')
      .that.is.not.undefined().and.does.not.deep.equal({
        secs: 0,
        nsecs: 0
      })
  })

  it('should update file mtime', async function () {
    this.slow(5 * 1000)
    const path = '/foo.txt'
    const mtime = new Date()
    const seconds = BigInt(Math.floor(mtime.getTime() / 1000))

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), path, {
      mtime: {
        secs: seconds
      }
    })

    await delay(2000)
    await fs.touch(path)

    await expect(fs.stat(path)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update directory mtime', async function () {
    this.slow(5 * 1000)
    const path = '/foo'
    const mtime = new Date()
    const seconds = BigInt(Math.floor(mtime.getTime() / 1000))

    await fs.mkdir(path, {
      mtime: {
        secs: seconds
      }
    })
    await delay(2000)
    await fs.touch(path)

    await expect(fs.stat(path)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update mtime recursively', async function () {
    this.slow(5 * 1000)
    const path = '/foo.txt'
    const mtime = new Date()
    const seconds = Math.floor(mtime.getTime() / 1000)

    await fs.writeBytes(Uint8Array.from([0, 1, 2, 3, 4]), path)

    await delay(2000)
    await fs.touch(path, {
      recursive: true
    })

    await expect(fs.stat(path)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)

    await expect(fs.stat(path)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)
  })

  it('should update the mtime for a hamt-sharded-directory', async function () {
    this.slow(5 * 1000)
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-dir'
    await fs.cp(shardedDirCid, shardedDirPath)
    await fs.touch(shardedDirPath)
    const originalMtime = (await fs.stat(shardedDirPath)).mtime

    if (originalMtime == null) {
      throw new Error('No originalMtime found')
    }

    await delay(2000)
    await fs.touch(shardedDirPath)
    const updatedMtime = (await fs.stat(shardedDirPath)).mtime

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
    const shardedDirPath = '/sharded-dir'
    await fs.cp(shardedDirCid, shardedDirPath)

    await delay(2000)
    await fs.touch(shardedDirPath, {
      recursive: true
    })

    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('mtime.secs')
      // no bigint support
      .that.satisfies((s: bigint) => s > seconds)

    for await (const file of fs.ls(shardedDirPath)) {
      expect(file).to.have.nested.property('unixfs.mtime.secs')
        // no bigint support
        .that.satisfies((s: bigint) => s > seconds)
    }
  })
})
