/* eslint-env mocha */

import { type MFS, mfs } from '@helia/mfs'
import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'

describe('mfs interop', () => {
  let helia: Helia
  let fs: MFS
  let kubo: Controller

  beforeEach(async () => {
    helia = await createHeliaNode()
    fs = mfs(helia)
    kubo = await createKuboNode()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should have the same CID initially', async () => {
    const heliaStat = await fs.stat('/')
    const kuboStat = await kubo.api.files.stat('/')

    expect(heliaStat.cid.toV1().toString()).to.equal(kuboStat.cid.toV1().toString())
  })

  it('should have the same CID after creating a directory', async () => {
    const dirPath = '/foo'
    await fs.mkdir(dirPath)
    await kubo.api.files.mkdir(dirPath, {
      cidVersion: 1
    })

    const heliaStat = await fs.stat('/')
    const kuboStat = await kubo.api.files.stat('/')

    expect(heliaStat.cid.toV1().toString()).to.equal(kuboStat.cid.toV1().toString())
  })

  it('should have the same CID after removing a directory', async () => {
    const dirPath = '/foo'
    await fs.mkdir(dirPath)
    await fs.rm(dirPath)
    await kubo.api.files.mkdir(dirPath, {
      cidVersion: 1
    })
    await kubo.api.files.rm(dirPath, {
      recursive: true
    })

    const heliaStat = await fs.stat('/')
    const kuboStat = await kubo.api.files.stat('/')

    expect(heliaStat.cid.toV1().toString()).to.equal(kuboStat.cid.toV1().toString())
  })

  it('should have the same CID after creating a file', async () => {
    const filePath = '/foo.txt'
    const fileData = Uint8Array.from([0, 1, 2, 3, 4])
    await fs.writeBytes(fileData, filePath, {
      rawLeaves: true,
      reduceSingleLeafToSelf: false
    })
    await kubo.api.files.write(filePath, fileData, {
      cidVersion: 1,
      create: true
    })

    const heliaStat = await fs.stat('/')
    const kuboStat = await kubo.api.files.stat('/')

    expect(heliaStat.cid.toV1().toString()).to.equal(kuboStat.cid.toV1().toString())
  })

  it('should have the same CID after removing a file', async () => {
    const filePath = '/foo.txt'
    const fileData = Uint8Array.from([0, 1, 2, 3, 4])
    await fs.writeBytes(fileData, filePath, {
      rawLeaves: true,
      reduceSingleLeafToSelf: false
    })
    await fs.rm(filePath)
    await kubo.api.files.write(filePath, fileData, {
      cidVersion: 1,
      create: true
    })
    await kubo.api.files.rm(filePath)

    const heliaStat = await fs.stat('/')
    const kuboStat = await kubo.api.files.stat('/')

    expect(heliaStat.cid.toV1().toString()).to.equal(kuboStat.cid.toV1().toString())
  })
})
