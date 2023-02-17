/* eslint-env mocha */

import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { expect } from 'aegir/chai'
import { identity } from 'multiformats/hashes/identity'
import { CID } from 'multiformats/cid'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'
import { importDirectory, importBytes } from 'ipfs-unixfs-importer'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import first from 'it-first'

describe('cp', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    const imported = await importDirectory({ path: 'empty' }, blockstore)
    emptyDirCid = imported.cid
  })

  it('refuses to copy files without a source', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp()).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a source, even with options', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp({})).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a destination', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp('/source')).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files without a destination, even with options', async () => {
    // @ts-expect-error invalid args
    await expect(fs.cp('/source', {})).to.eventually.be.rejected.with('Please supply at least one source')
  })

  it('refuses to copy files to an unreadable node', async () => {
    const hash = identity.digest(uint8ArrayFromString('derp'))
    const { cid: source } = await importBytes(Uint8Array.from([0, 1, 3, 4]), blockstore)
    const target = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, target, 'foo')).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_A_DIRECTORY')
  })

  it('refuses to copy files from an unreadable node', async () => {
    const hash = identity.digest(uint8ArrayFromString('derp'))
    const source = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, emptyDirCid, 'foo')).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_UNIXFS')
  })

  it('refuses to copy files to an existing file', async () => {
    const path = 'path'
    const { cid: source } = await importBytes(Uint8Array.from([0, 1, 3, 4]), blockstore)
    const target = await fs.cp(source, emptyDirCid, path)

    await expect(fs.cp(source, target, path)).to.eventually.be.rejected
      .with.property('code', 'ERR_ALREADY_EXISTS')

    // should succeed with force option
    await expect(fs.cp(source, target, path, {
      force: true
    })).to.eventually.be.ok()
  })

  it('copies a file to new location', async () => {
    const data = Uint8Array.from([0, 1, 3, 4])
    const path = 'path'
    const { cid: source } = await importBytes(data, blockstore)
    const dirCid = await fs.cp(source, emptyDirCid, path)

    const bytes = await toBuffer(fs.cat(dirCid, {
      path
    }))

    expect(bytes).to.deep.equal(data)
  })

  it('copies directories', async () => {
    const path = 'path'
    const dirCid = await fs.cp(emptyDirCid, emptyDirCid, path)

    await expect(fs.stat(dirCid, {
      path
    })).to.eventually.include({
      type: 'directory'
    })
  })

  it('copies a sharded directory to a normal directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const path = 'sharded-dir'
    const containingDirCid = await fs.cp(shardedDirCid, emptyDirCid, path)

    // should still be a regular directory
    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'directory')

    const subDirStats = await fs.stat(containingDirCid, {
      path
    })
    expect(subDirStats).to.have.nested.property('unixfs.type', 'hamt-sharded-directory')
    expect(subDirStats.cid).to.eql(shardedDirCid)
  })

  it('copies a normal directory to a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const path = 'normal-dir'
    const containingDirCid = await fs.cp(emptyDirCid, shardedDirCid, path)

    // should still be a sharded directory
    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const subDirStats = await fs.stat(containingDirCid, {
      path
    })
    expect(subDirStats).to.have.nested.property('unixfs.type', 'directory')
    expect(subDirStats.cid).to.eql(emptyDirCid)
  })

  it('copies a file from a normal directory to a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const path = `file-${Math.random()}.txt`
    const { cid: fileCid } = await importBytes(Uint8Array.from([0, 1, 2, 3]), blockstore, {
      rawLeaves: false
    })

    const containingDirCid = await fs.cp(fileCid, shardedDirCid, path)

    // should still be a sharded directory
    await expect(fs.stat(containingDirCid)).to.eventually.have.nested.property('unixfs.type', 'hamt-sharded-directory')

    const fileInDirStats = await fs.stat(containingDirCid, {
      path
    })
    expect(fileInDirStats).to.have.nested.property('unixfs.type', 'file')
    expect(fileInDirStats.cid).to.eql(fileCid)
  })

  it('refuses to copy files to an existing file in a sharded directory', async () => {
    const shardedDirCid = await createShardedDirectory(blockstore)
    const file = await first(fs.ls(shardedDirCid))

    if (file == null) {
      throw new Error('No files listed')
    }

    await expect(fs.cp(file.cid, shardedDirCid, file.name)).to.eventually.be.rejected
      .with.property('code', 'ERR_ALREADY_EXISTS')

    // should succeed with force option
    await expect(fs.cp(file.cid, shardedDirCid, file.name, {
      force: true
    })).to.eventually.be.ok()
  })
})
