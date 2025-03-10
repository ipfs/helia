/* eslint-env mocha */

import { unixfs } from '@helia/unixfs'
import { expect } from 'aegir/chai'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { AddOptions, UnixFS } from '@helia/unixfs'
import type { HeliaLibp2p } from 'helia'
import type { ByteStream } from 'ipfs-unixfs-importer'
import type { KuboNode } from 'ipfsd-ctl'
import type { AddOptions as KuboAddOptions } from 'kubo-rpc-client'

describe('@helia/unixfs - files', () => {
  let helia: HeliaLibp2p
  let unixFs: UnixFS
  let kubo: KuboNode

  async function importToHelia (data: ByteStream, opts?: Partial<AddOptions>): Promise<CID> {
    const cid = await unixFs.addByteStream(data, opts)

    return cid
  }

  async function importToKubo (data: ByteStream, opts?: KuboAddOptions): Promise<CID> {
    const result = await kubo.api.add(data, opts)

    return CID.parse(result.cid.toString())
  }

  async function expectSameCid (data: () => ByteStream, heliaOpts: Partial<AddOptions> = {}, kuboOpts: KuboAddOptions = {}): Promise<void> {
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
    const candidate = (): ByteStream => (async function * () {
      yield Uint8Array.from([0, 1, 2, 3, 4])
    }())

    await expectSameCid(candidate)
  })

  it('should create the same CID for a large file', async () => {
    const chunkSize = 1024 * 1024
    const size = chunkSize * 10

    const candidate = (): ByteStream => (async function * () {
      for (let i = 0; i < size; i += chunkSize) {
        yield new Uint8Array(chunkSize)
      }
    }())

    await expectSameCid(candidate)
  })
})
