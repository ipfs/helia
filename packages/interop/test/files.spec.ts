/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from '@helia/interface'
import type { Controller } from 'ipfsd-ctl'
import { UnixFS, unixfs } from '@helia/unixfs'
import { balanced } from 'ipfs-unixfs-importer/layout'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import type { FileCandidate, ImporterOptions } from 'ipfs-unixfs-importer'
import type { CID } from 'multiformats/cid'
import type { AddOptions } from 'ipfs-core-types/src/root.js'

describe('unixfs interop', () => {
  let helia: Helia
  let unixFs: UnixFS
  let kubo: Controller

  async function importToHelia (data: FileCandidate, opts?: Partial<ImporterOptions>): Promise<CID> {
    const cid = await unixFs.addFile(data, opts)

    return cid
  }

  async function importToKubo (data: FileCandidate, opts?: AddOptions): Promise<CID> {
    const result = await kubo.api.add(data.content, opts)

    return result.cid
  }

  async function expectSameCid (data: () => FileCandidate, heliaOpts: Partial<ImporterOptions> = {}, kuboOpts: AddOptions = {}): Promise<void> {
    const heliaCid = await importToHelia(data(), {
      // these are the default kubo options
      cidVersion: 0,
      rawLeaves: false,
      layout: balanced({
        maxChildrenPerNode: 174
      }),
      chunker: fixedSize({
        chunkSize: 262144
      }),

      ...heliaOpts
    })
    const kuboCid = await importToKubo(data(), kuboOpts)

    expect(heliaCid.toString()).to.equal(kuboCid.toString())
  }

  beforeEach(async () => {
    helia = await createHeliaNode()
    unixFs = unixfs(helia)
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

  it('should create the same CID for a small file', async () => {
    const candidate = (): FileCandidate => ({
      content: Uint8Array.from([0, 1, 2, 3, 4])
    })

    await expectSameCid(candidate)
  })

  it('should create the same CID for a large file', async () => {
    const chunkSize = 1024 * 1024
    const size = chunkSize * 10

    const candidate = (): FileCandidate => ({
      content: (async function * () {
        for (let i = 0; i < size; i += chunkSize) {
          yield new Uint8Array(chunkSize)
        }
      }())
    })

    await expectSameCid(candidate)
  })
})
