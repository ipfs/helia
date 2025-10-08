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
import type { Mtime } from 'ipfs-unixfs'

describe('mkdir', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    fs = mfs({ blockstore, datastore, logger })
  })

  async function testMode (mode: number | undefined, expectedMode: number): Promise<void> {
    const path = '/sub-directory'
    await fs.mkdir(path, {
      mode
    })

    await expect(fs.stat(path)).to.eventually.have.property('mode', expectedMode)
  }

  async function testMtime (mtime: Mtime, expectedMtime: Mtime): Promise<void> {
    const path = '/sub-directory'
    await fs.mkdir(path, {
      mtime
    })

    await expect(fs.stat(path)).to.eventually.have.deep.property('mtime', expectedMtime)
  }

  it('requires a path', async () => {
    // @ts-expect-error not enough arguments
    await expect(fs.mkdir()).to.eventually.be.rejected()
  })

  it('creates a directory', async () => {
    const dirName = 'foo'
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    const stats = await fs.stat(dirPath)
    expect(stats.type).to.equal('directory')

    const files = await all(fs.ls())

    expect(files.length).to.equal(1)
    expect(files).to.have.nested.property('[0].name', dirName)
  })

  it('refuses to create a directory that already exists', async () => {
    const dirName = 'foo'
    const dirPath = `/${dirName}`
    await fs.mkdir(dirPath)

    await expect(fs.mkdir(dirPath)).to.eventually.be.rejected()
      .with.property('name', 'AlreadyExistsError')
  })

  it('creates a nested directory with a different CID version to the parent', async () => {
    const path = '/qux'
    const subDirectory = `${path}/sub-dir`

    await fs.mkdir(path, {
      cidVersion: 1
    })
    await fs.mkdir(subDirectory, {
      cidVersion: 0
    })

    await expect(fs.stat(path)).to.eventually.have.nested.property('cid.version', 1)
    await expect(fs.stat(subDirectory)).to.eventually.have.nested.property('cid.version', 0)
  })

  it('should make directory and have default mode', async function () {
    await testMode(undefined, parseInt('0755', 8))
  })

  it('should make directory and specify mtime as { nsecs, secs }', async function () {
    const mtime = {
      secs: 5n,
      nsecs: 0
    }

    await testMtime(mtime, mtime)
  })

  it('makes a directory inside a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const shardedDirPath = '/sharded-directory'
    await fs.cp(shardedDirCid, shardedDirPath)
    const dirName = `${shardedDirPath}/subdir-${Math.random()}`

    await fs.mkdir(dirName)

    // should still be a sharded directory
    await expect(fs.stat(shardedDirPath)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    // subdir should be a regular directory
    await expect(fs.stat(dirName)).to.eventually.have.nested.property('unixfs.type', 'directory')
  })
})
