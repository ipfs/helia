/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
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
})
