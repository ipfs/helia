/* eslint-env mocha */

import { car } from '@helia/car'
import { dagCbor } from '@helia/dag-cbor'
import { dagJson } from '@helia/dag-json'
import { mfs } from '@helia/mfs'
import { strings } from '@helia/strings'
import { unixfs } from '@helia/unixfs'
import { createScalableCuckooFilter } from '@libp2p/utils/filters'
import { expect } from 'aegir/chai'
import toBuffer from 'it-to-buffer'
import { multiaddr } from 'kubo-rpc-client'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import type { Helia } from 'helia'
import type { FileCandidate } from 'ipfs-unixfs-importer'
import type { KuboInfo, KuboNode } from 'ipfsd-ctl'

describe('providers', () => {
  let helia: Helia
  let kubo: KuboNode
  let cid: CID
  let kuboInfo: KuboInfo
  let input: Uint8Array[]

  beforeEach(async () => {
    // helia and kubo are not connected together before the test
    helia = await createHeliaNode()
    kubo = await createKuboNode()

    const chunkSize = 1024 * 1024
    const size = chunkSize * 10
    input = []

    const candidate: FileCandidate = {
      content: (async function * () {
        for (let i = 0; i < size; i += chunkSize) {
          const buf = new Uint8Array(chunkSize)
          input.push(buf)

          yield buf
        }
      }())
    }

    const importResult = await kubo.api.add(candidate.content)
    cid = CID.parse(importResult.cid.toString())
    kuboInfo = await kubo.info()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }

    if (kubo != null) {
      await kubo.stop()
    }
  })

  it('should fetch raw using a provider', async () => {
    const buf = await helia.blockstore.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    })

    expect(buf).to.have.lengthOf(1930)
  })

  it('should fetch dag-cbor using a provider', async () => {
    const obj = { hello: 'world' }
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-cbor'
    })

    const d = dagCbor(helia)

    await expect(d.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    })).to.eventually.deep.equal(obj)
  })

  it('should fetch dag-json using a provider', async () => {
    const obj = { hello: 'world' }
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-json'
    })

    const d = dagJson(helia)

    await expect(d.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    })).to.eventually.deep.equal(obj)
  })

  it('should fetch string using a provider', async () => {
    const obj = 'hello world'
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-json'
    })

    const s = strings(helia)

    await expect(s.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    })).to.eventually.equal(JSON.stringify(obj))
  })

  it('should fetch via unixfs using a provider', async () => {
    const fs = unixfs(helia)

    const bytes = await toBuffer(fs.cat(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    }))

    expect(bytes).to.equalBytes(toBuffer(input))
  })

  it('should fetch via mfs using a provider', async () => {
    const fs = mfs(helia)

    await fs.cp(cid, '/file.txt', {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ]
    })

    const bytes = await toBuffer(fs.cat('/file.txt'))

    expect(bytes).to.equalBytes(toBuffer(input))
  })

  it('should fetch via car using a provider', async () => {
    const c = car(helia)

    expect(await toBuffer(
      c.stream(cid, {
        providers: [
          kuboInfo.multiaddrs.map(ma => multiaddr(ma))
        ],
        blockFilter: createScalableCuckooFilter(10)
      }))
    ).to.equalBytes(await toBuffer(
      kubo.api.dag.export(cid)
    ))
  })
})
