/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import all from 'it-all'
import drain from 'it-drain'
import toBuffer from 'it-to-buffer'
import { unixfs, type UnixFS } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

describe('cat', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.addDirectory()
  })

  it('reads a small file', async () => {
    const cid = await fs.addBytes(smallFile)
    const bytes = await toBuffer(fs.cat(cid))

    expect(bytes).to.equalBytes(smallFile)
  })

  it('reads a file with an offset', async () => {
    const offset = 10
    const cid = await fs.addBytes(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      offset
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset))
  })

  it('reads a file with a length', async () => {
    const length = 10
    const cid = await fs.addBytes(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(0, length))
  })

  it('reads a file with an offset and a length', async () => {
    const offset = 2
    const length = 5
    const cid = await fs.addBytes(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      offset,
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset, offset + length))
  })

  it('refuses to read a directory', async () => {
    await expect(drain(fs.cat(emptyDirCid))).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_A_FILE')
  })

  it('refuses to read missing blocks', async () => {
    const cid = await fs.addBytes(smallFile)

    await blockstore.delete(cid)
    expect(blockstore.has(cid)).to.be.false()

    await expect(drain(fs.cat(cid, {
      offline: true
    }))).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_FOUND')
  })

  it('reads file from inside a sharded directory', async () => {
    const dirCid = await createShardedDirectory(blockstore)
    const fileCid = await fs.addBytes(smallFile)
    const path = 'new-file.txt'

    const updatedCid = await fs.cp(fileCid, dirCid, path)

    const bytes = await toBuffer(fs.cat(updatedCid, {
      path
    }))

    expect(bytes).to.deep.equal(smallFile)
  })

  it('should only load blocks necessary to traverse a HAMT', async () => {
    const [, scriptFile, styleFile, imageFile, dir] = await all(fs.addAll([{
      path: 'index.html',
      content: Uint8Array.from([0, 1, 2])
    }, {
      path: 'script.js',
      content: Uint8Array.from([3, 4, 5])
    }, {
      path: 'style.css',
      content: Uint8Array.from([6, 7, 8])
    }, {
      path: 'image.png',
      content: Uint8Array.from([9, 0, 1])
    }], {
      shardSplitThresholdBytes: 1,
      wrapWithDirectory: true
    }))

    const dirStat = await fs.stat(dir.cid)
    expect(dirStat.unixfs?.type).to.equal('hamt-sharded-directory')

    // remove all blocks that aren't the index file
    await drain(blockstore.deleteMany([
      scriptFile.cid,
      styleFile.cid,
      imageFile.cid
    ]))

    // should be able to cat the index file without loading the other files
    // in the shard - the blockstore is offline so will throw if requested
    // blocks are not present
    const bytes = await toBuffer(fs.cat(dir.cid, {
      path: 'index.html'
    }))

    expect(bytes).to.equalBytes(Uint8Array.from([0, 1, 2]))
  })
})
