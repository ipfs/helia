/* eslint-env mocha */

import { expect } from 'aegir/chai'
import all from 'it-all'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import type { CID } from 'multiformats/cid'
import type { Mtime } from 'ipfs-unixfs'
import { importDirectory } from 'ipfs-unixfs-importer'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'

describe('mkdir', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID
  let emptyDirCidV0: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    const imported = await importDirectory({ path: 'empty' }, blockstore)
    emptyDirCid = imported.cid

    const importedV0 = await importDirectory({ path: 'empty' }, blockstore, {
      cidVersion: 0
    })
    emptyDirCidV0 = importedV0.cid
  })

  async function testMode (mode: number | undefined, expectedMode: number): Promise<void> {
    const path = 'sub-directory'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mode
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.have.property('mode', expectedMode)
  }

  async function testMtime (mtime: Mtime, expectedMtime: Mtime): Promise<void> {
    const path = 'sub-directory'
    const dirCid = await fs.mkdir(emptyDirCid, path, {
      mtime
    })

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.have.deep.property('mtime', expectedMtime)
  }

  it('requires a directory', async () => {
    // @ts-expect-error not enough arguments
    await expect(fs.mkdir(emptyDirCid)).to.eventually.be.rejected()
  })

  it('creates a directory', async () => {
    const path = 'foo'
    const dirCid = await fs.mkdir(emptyDirCid, path)

    const stats = await fs.stat(dirCid)
    expect(stats.type).to.equal('directory')

    const files = await all(fs.ls(dirCid))

    expect(files.length).to.equal(1)
    expect(files).to.have.nested.property('[0].name', path)
  })

  it('refuses to create a directory that already exists', async () => {
    const path = 'qux'
    const dirCid = await fs.mkdir(emptyDirCid, path)

    await expect(fs.mkdir(dirCid, path)).to.eventually.be.rejected()
      .with.property('code', 'ERR_ALREADY_EXISTS')
  })

  it('creates a nested directory with a different CID version to the parent', async () => {
    const subDirectory = 'sub-dir'

    expect(emptyDirCidV0).to.have.property('version', 0)

    const dirCid = await fs.mkdir(emptyDirCidV0, subDirectory, {
      cidVersion: 1
    })

    await expect(fs.stat(dirCid)).to.eventually.have.nested.property('cid.version', 0)
    await expect(fs.stat(dirCid, {
      path: subDirectory
    })).to.eventually.have.nested.property('cid.version', 1)
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
    const dirName = `subdir-${Math.random()}`

    const updatedShardCid = await fs.mkdir(shardedDirCid, dirName)

    // should still be a sharded directory
    await expect(fs.stat(updatedShardCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    // subdir should be a regular directory
    await expect(fs.stat(updatedShardCid, {
      path: dirName
    })).to.eventually.have.nested.property('unixfs.type', 'directory')
  })
})
