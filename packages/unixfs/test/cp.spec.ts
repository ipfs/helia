/* eslint-env mocha */

import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { expect } from 'aegir/chai'
import { identity } from 'multiformats/hashes/identity'
import { CID } from 'multiformats/cid'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'

describe('cp', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })
    emptyDirCid = await fs.add({ path: 'empty' })
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
    const source = await fs.add(Uint8Array.from([0, 1, 3, 4]))
    const target = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, target, 'foo')).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_DIRECTORY')
  })

  it('refuses to copy files from an unreadable node', async () => {
    const hash = identity.digest(uint8ArrayFromString('derp'))
    const source = CID.createV1(identity.code, hash)

    await expect(fs.cp(source, emptyDirCid, 'foo')).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_UNIXFS')
  })

  it('refuses to copy files to an existing file', async () => {
    const path = 'path'
    const source = await fs.add(Uint8Array.from([0, 1, 3, 4]))
    const target = await fs.cp(source, emptyDirCid, path)

    await expect(fs.cp(source, target, path)).to.eventually.be.rejected
      .with.property('code', 'ERR_ALREADY_EXISTS')
  })

  it('copies a file to new location', async () => {
    const data = Uint8Array.from([0, 1, 3, 4])
    const path = 'path'
    const source = await fs.add(data)
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

/*
  describe('with sharding', () => {
    it('copies a sharded directory to a normal directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)

      const normalDir = `dir-${Math.random()}`
      const normalDirPath = `/${normalDir}`

      await ipfs.files.mkdir(normalDirPath)

      await ipfs.files.cp(shardedDirPath, normalDirPath)

      const finalShardedDirPath = `${normalDirPath}${shardedDirPath}`

      // should still be a sharded directory
      await expect(isShardAtPath(finalShardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(finalShardedDirPath)).type).to.equal('directory')

      const files = await all(ipfs.files.ls(finalShardedDirPath))

      expect(files.length).to.be.ok()
    })

    it('copies a normal directory to a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)

      const normalDir = `dir-${Math.random()}`
      const normalDirPath = `/${normalDir}`

      await ipfs.files.mkdir(normalDirPath)

      await ipfs.files.cp(normalDirPath, shardedDirPath)

      const finalDirPath = `${shardedDirPath}${normalDirPath}`

      // should still be a sharded directory
      await expect(isShardAtPath(shardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(shardedDirPath)).type).to.equal('directory')
      expect((await ipfs.files.stat(finalDirPath)).type).to.equal('directory')
    })

    it('copies a file from a normal directory to a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)

      const file = `file-${Math.random()}.txt`
      const filePath = `/${file}`
      const finalFilePath = `${shardedDirPath}/${file}`

      await ipfs.files.write(filePath, Uint8Array.from([0, 1, 2, 3]), {
        create: true
      })

      await ipfs.files.cp(filePath, finalFilePath)

      // should still be a sharded directory
      await expect(isShardAtPath(shardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(shardedDirPath)).type).to.equal('directory')
      expect((await ipfs.files.stat(finalFilePath)).type).to.equal('file')
    })

    it('copies a file from a sharded directory to a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const othershardedDirPath = await createShardedDirectory(ipfs)

      const file = `file-${Math.random()}.txt`
      const filePath = `${shardedDirPath}/${file}`
      const finalFilePath = `${othershardedDirPath}/${file}`

      await ipfs.files.write(filePath, Uint8Array.from([0, 1, 2, 3]), {
        create: true
      })

      await ipfs.files.cp(filePath, finalFilePath)

      // should still be a sharded directory
      await expect(isShardAtPath(shardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(shardedDirPath)).type).to.equal('directory')
      await expect(isShardAtPath(othershardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(othershardedDirPath)).type).to.equal('directory')
      expect((await ipfs.files.stat(finalFilePath)).type).to.equal('file')
    })

    it('copies a file from a sharded directory to a normal directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const dir = `dir-${Math.random()}`
      const dirPath = `/${dir}`

      const file = `file-${Math.random()}.txt`
      const filePath = `${shardedDirPath}/${file}`
      const finalFilePath = `${dirPath}/${file}`

      await ipfs.files.write(filePath, Uint8Array.from([0, 1, 2, 3]), {
        create: true
      })

      await ipfs.files.mkdir(dirPath)

      await ipfs.files.cp(filePath, finalFilePath)

      // should still be a sharded directory
      await expect(isShardAtPath(shardedDirPath, ipfs)).to.eventually.be.true()
      expect((await ipfs.files.stat(shardedDirPath)).type).to.equal('directory')
      expect((await ipfs.files.stat(dirPath)).type).to.equal('directory')
      expect((await ipfs.files.stat(finalFilePath)).type).to.equal('file')
    })
  })
  */
})
