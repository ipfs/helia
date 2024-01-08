/* eslint-env mocha */

import { car } from '@helia/car'
import { type UnixFS, unixfs } from '@helia/unixfs'
import { CarReader } from '@ipld/car'
import { expect } from 'aegir/chai'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { memoryCarWriter } from './fixtures/memory-car.js'
import type { Car } from '@helia/car'
import type { Helia } from '@helia/interface'
import type { FileCandidate } from 'ipfs-unixfs-importer'
import type { Controller } from 'ipfsd-ctl'

describe('car interop', () => {
  let helia: Helia
  let c: Car
  let u: UnixFS
  let kubo: Controller

  beforeEach(async () => {
    helia = await createHeliaNode()
    c = car(helia)
    u = unixfs(helia)
    kubo = await createKuboNode()

    // connect helia to kubo
    await helia.libp2p.dial(kubo.peer.addresses)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should export a car from Helia, import and read the contents from kubo', async () => {
    const chunkSize = 1024 * 1024
    const size = chunkSize * 10
    const input: Uint8Array[] = []

    const candidate: FileCandidate = {
      content: (async function * () {
        for (let i = 0; i < size; i += chunkSize) {
          const buf = new Uint8Array(chunkSize)
          input.push(buf)

          yield buf
        }
      }())
    }

    const cid = await u.addFile(candidate)
    const writer = memoryCarWriter(cid)
    await c.export(cid, writer)

    const buf = await writer.bytes()

    kubo.api.dag.import([buf])

    const bytes = await toBuffer(kubo.api.cat(cid))

    expect(bytes).to.equalBytes(toBuffer(input))
  })

  it('should export a car from kubo, import and read the contents from Helia', async () => {
    const chunkSize = 1024 * 1024
    const size = chunkSize * 10
    const input: Uint8Array[] = []

    const candidate: FileCandidate = {
      content: (async function * () {
        for (let i = 0; i < size; i += chunkSize) {
          const buf = new Uint8Array(chunkSize)
          input.push(buf)

          yield buf
        }
      }())
    }

    const { cid } = await kubo.api.add(candidate.content)
    const bytes = await toBuffer(kubo.api.dag.export(cid))

    const reader = await CarReader.fromBytes(bytes)

    await c.import(reader)

    expect(await toBuffer(u.cat(CID.parse(cid.toString())))).to.equalBytes(toBuffer(input))
  })
})
