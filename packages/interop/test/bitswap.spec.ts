/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'
import { UnixFS, unixfs } from '@helia/unixfs'
import type { FileCandidate } from 'ipfs-unixfs-importer'
import toBuffer from 'it-to-buffer'

describe('unixfs bitswap interop', () => {
  let helia: Helia
  let unixFs: UnixFS
  let kubo: Controller

  beforeEach(async () => {
    helia = await createHeliaNode()
    unixFs = unixfs(helia)
    kubo = await createKuboNode()

    // connect helia to kubo
    await helia.libp2p.peerStore.addressBook.add(kubo.peer.id, kubo.peer.addresses)
    await helia.libp2p.dial(kubo.peer.id)
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should add a large file to helia and fetch it from kubo', async () => {
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

    const cid = await unixFs.addFile(candidate)

    const bytes = await toBuffer(kubo.api.cat(cid))

    expect(bytes).to.equalBytes(await toBuffer(input))
  })

  it('should add a large file to kubo and fetch it from helia', async () => {
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

    const bytes = await toBuffer(unixFs.cat(cid))

    expect(bytes).to.equalBytes(await toBuffer(input))
  })
})
