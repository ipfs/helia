/* eslint-env mocha */

import { expect } from 'aegir/chai'
import type { CID } from 'multiformats/cid'
import type { Blockstore } from 'interface-blockstore'
import { unixfs, UnixFS } from '../src/index.js'
import { MemoryBlockstore } from 'blockstore-core'
import toBuffer from 'it-to-buffer'
import drain from 'it-drain'

const smallFile = Uint8Array.from(new Array(13).fill(0).map(() => Math.random() * 100))

describe('cat', () => {
  let blockstore: Blockstore
  let fs: UnixFS
  let emptyDirCid: CID

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()

    fs = unixfs({ blockstore })

    emptyDirCid = await fs.add({ path: 'empty' })
  })

  it('reads a small file', async () => {
    const cid = await fs.add(smallFile)
    const bytes = await toBuffer(fs.cat(cid))

    expect(bytes).to.equalBytes(smallFile)
  })

  it('reads a file with an offset', async () => {
    const offset = 10
    const cid = await fs.add(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      offset
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset))
  })

  it('reads a file with a length', async () => {
    const length = 10
    const cid = await fs.add(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(0, length))
  })

  it('reads a file with an offset and a length', async () => {
    const offset = 2
    const length = 5
    const cid = await fs.add(smallFile)
    const bytes = await toBuffer(fs.cat(cid, {
      offset,
      length
    }))

    expect(bytes).to.equalBytes(smallFile.subarray(offset, offset + length))
  })

  it('refuses to read a directory', async () => {
    await expect(drain(fs.cat(emptyDirCid))).to.eventually.be.rejected
      .with.property('code', 'ERR_NOT_FILE')
  })

/*
  describe('with sharding', () => {
    it('reads file from inside a sharded directory', async () => {
      const shardedDirPath = await createShardedDirectory(ipfs)
      const filePath = `${shardedDirPath}/file-${Math.random()}.txt`
      const content = Uint8Array.from([0, 1, 2, 3, 4])

      await ipfs.files.write(filePath, content, {
        create: true
      })

      const bytes = uint8ArrayConcat(await all(ipfs.files.read(filePath)))

      expect(bytes).to.deep.equal(content)
    })
  })
  */
})
