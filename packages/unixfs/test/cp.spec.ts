/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import first from 'it-first'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { identity } from 'multiformats/hashes/identity'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { unixfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { createSubShardedDirectory } from './fixtures/create-subsharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { UnixFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'

describe('cp', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
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
    const source = await fs.addBytes(Uint8Array.from([0, 1, 3, 4]))
    const target = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, target, 'foo')).to.eventually.be.rejected
      .with.property('name', 'NotADirectoryError')
  })

  it('refuses to copy files from an unreadable node', async () => {
    const hash = identity.digest(uint8ArrayFromString('derp'))
    const source = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, emptyDirCid, 'foo')).to.eventually.be.rejected
      .with.property('name', 'NotUnixFSError')
  })

  it('refuses to copy files to an existing file', async () => {
    const path = 'path'
    const source = await fs.addBytes(Uint8Array.from([0, 1, 3, 4]))
    const target = await fs.cp(source, emptyDirCid, path)

    await expect(fs.cp(source, target, path)).to.eventually.be.rejected
      .with.property('name', 'AlreadyExistsError')

    // should succeed with force option
    await expect(fs.cp(source, target, path, {
      force: true
    })).to.eventually.be.ok()
  })

  it('copies a file to new location', async () => {
    const data = Uint8Array.from([0, 1, 3, 4])
    const path = 'path'
    const source = await fs.addBytes(data)
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
    const fileCid = await fs.addBytes(Uint8Array.from([0, 1, 3, 4]), {
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
      .with.property('name', 'AlreadyExistsError')

    // should succeed with force option
    await expect(fs.cp(file.cid, shardedDirCid, file.name, {
      force: true
    })).to.eventually.be.ok()
  })

  it('copies a file to a sharded directory that creates a sub-shard', async () => {
    const {
      containingDirCid,
      fileName,
      importerCid
    } = await createSubShardedDirectory(blockstore)

    // adding a file to the importer CID should result in the shard with a subshard
    const fileCid = CID.parse('bafkreiaixnpf23vkyecj5xqispjq5ubcwgsntnnurw2bjby7khe4wnjihu')
    const finalDirCid = await fs.cp(fileCid, importerCid, fileName)

    expect(finalDirCid).to.eql(containingDirCid, 'adding a file to the imported dir did not result in the same CID')
  })

  it('refuses to copy missing blocks', async () => {
    const cid = await fs.addBytes(smallFile)

    await blockstore.delete(cid)
    expect(blockstore.has(cid)).to.be.false()

    await expect(fs.cp(cid, cid, 'file.txt', {
      offline: true
    })).to.eventually.be.rejected
      .with.property('name', 'NotFoundError')
  })
})
