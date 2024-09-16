/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import drain from 'it-drain'
import toBuffer from 'it-to-buffer'
import { mfs, type MFS } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('cat', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()

    fs = mfs({ blockstore, datastore })
  })

  it('reads a small file', async () => {
    const path = '/foo.txt'
    await fs.writeBytes(smallFile, path)

    const bytes = await toBuffer(fs.cat(path))

    expect(bytes).to.equalBytes(smallFile)
  })

  it('reads a file with an offset', async () => {
    const path = '/foo.txt'
    const offset = 10

    await fs.writeBytes(smallFile, path)
    const bytes = await toBuffer(fs.cat(path, {
      offset
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset))
  })

  it('reads a file with a length', async () => {
    const path = '/foo.txt'
    const length = 10
    await fs.writeBytes(smallFile, path)

    const bytes = await toBuffer(fs.cat(path, {
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(0, length))
  })

  it('reads a file with an offset and a length', async () => {
    const path = '/foo.txt'
    const offset = 2
    const length = 5
    await fs.writeBytes(smallFile, path)

    const bytes = await toBuffer(fs.cat(path, {
      offset,
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset, offset + length))
  })

  it('refuses to read a directory', async () => {
    const path = '/foo'

    await fs.mkdir(path)

    await expect(drain(fs.cat(path))).to.eventually.be.rejected
      .with.property('name', 'NotAFileError')
  })

  it('reads file from inside a sharded directory', async () => {
    const shardedDirPath = '/foo'
    const shardedDirCid = await createShardedDirectory(blockstore)
    const filePath = `${shardedDirPath}/new-file.txt`

    await fs.cp(shardedDirCid, shardedDirPath)
    await fs.writeBytes(smallFile, filePath)

    const bytes = await toBuffer(fs.cat(filePath))

    expect(bytes).to.deep.equal(smallFile)
  })
})
