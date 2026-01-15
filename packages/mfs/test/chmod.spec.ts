import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { mfs } from '../src/index.js'
import { createShardedDirectory } from './fixtures/create-sharded-directory.js'
import { smallFile } from './fixtures/files.js'
import type { MFS } from '../src/index.js'
import type { Blockstore } from 'interface-blockstore'
import type { Datastore } from 'interface-datastore'

describe('chmod', () => {
  let blockstore: Blockstore
  let datastore: Datastore
  let fs: MFS

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    datastore = new MemoryDatastore()
    const logger = defaultLogger()

    fs = mfs({ blockstore, datastore, logger })
  })

  it('should update the mode for a raw node', async () => {
    const path = '/foo.txt'
    await fs.writeBytes(smallFile, path)
    const originalMode = (await fs.stat(path)).mode

    await fs.chmod(path, 0o777)

    const updatedMode = (await fs.stat(path)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update the mode for a file', async () => {
    const path = '/foo.txt'
    await fs.writeBytes(smallFile, path, {
      rawLeaves: false
    })
    const originalMode = (await fs.stat(path)).mode
    await fs.chmod(path, 0o777)

    const updatedMode = (await fs.stat(path)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update the mode for a directory', async () => {
    const path = '/foo'
    await fs.mkdir(path)
    const originalMode = (await fs.stat(path)).mode
    await fs.chmod(path, 0o777)

    const updatedMode = (await fs.stat(path)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update mode recursively', async () => {
    const dirPath = '/foo'
    const filePath = `${dirPath}/bar/baz.txt`
    await fs.mkdir('/foo')
    await fs.mkdir('/foo/bar')
    await fs.writeBytes(smallFile, filePath)

    const originalMode = (await fs.stat(filePath)).mode
    await fs.chmod(dirPath, 0o777, {
      recursive: true
    })

    const updatedMode = (await fs.stat(filePath)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })

  it('should update the mode for a hamt-sharded-directory', async () => {
    const shardedDirPath = '/foo'
    const shardedDirCid = await createShardedDirectory(blockstore)
    await fs.cp(shardedDirCid, shardedDirPath)

    const originalMode = (await fs.stat(shardedDirPath)).mode

    await fs.chmod(shardedDirPath, 0o777)

    const updatedMode = (await fs.stat(shardedDirPath)).mode
    expect(updatedMode).to.not.equal(originalMode)
    expect(updatedMode).to.equal(0o777)
  })
})
