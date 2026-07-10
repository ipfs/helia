import { car } from '@helia/car'
import { dagCbor } from '@helia/dag-cbor'
import { dagJson } from '@helia/dag-json'
import { mfs } from '@helia/mfs'
import { strings } from '@helia/strings'
import { unixfs } from '@helia/unixfs'
import { peerIdFromString } from '@libp2p/peer-id'
import { createScalableCuckooFilter } from '@libp2p/utils'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import toBuffer from 'it-to-buffer'
import { multiaddr } from 'kubo-rpc-client'
import { CID } from 'multiformats/cid'
import { createHeliaNode } from './fixtures/create-helia.ts'
import { createKuboNode } from './fixtures/create-kubo.ts'
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

  it('should fail to fetch without using a provider', async () => {
    await expect(drain(helia.blockstore.get(cid, {
      signal: AbortSignal.timeout(100)
    }))).to.eventually.be.rejected()
      .with.nested.property('errors[0].name', 'AbortError')
  })

  it('should fetch raw using a provider', async () => {
    let sender: CID | undefined

    const buf = await toBuffer(helia.blockstore.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    }))

    // The Kubo node uses the unixfs-v1-2025 profile (see create-kubo.ts), so a
    // 10 MiB file is 1 MiB chunks -> 10 raw CIDv1 leaf links -> 509-byte dag-pb
    // root (the legacy CIDv0 / 256 KiB defaults gave 40 links / 1930).
    expect(buf).to.have.lengthOf(509)
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch dag-cbor using a provider', async () => {
    let sender: CID | undefined
    const obj = { hello: 'world' }
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-cbor'
    })

    const d = dagCbor(helia)

    await expect(d.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    })).to.eventually.deep.equal(obj)
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch dag-json using a provider', async () => {
    let sender: CID | undefined
    const obj = { hello: 'world' }
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-json'
    })

    const d = dagJson(helia)

    await expect(d.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    })).to.eventually.deep.equal(obj)
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch string using a provider', async () => {
    let sender: CID | undefined
    const obj = 'hello world'
    const cid = await kubo.api.dag.put(obj, {
      storeCodec: 'dag-json'
    })

    const s = strings(helia)

    await expect(s.get(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    })).to.eventually.equal(JSON.stringify(obj))
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch via unixfs using a provider', async () => {
    let sender: CID | undefined
    const fs = unixfs(helia)

    const bytes = await toBuffer(fs.cat(cid, {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    }))

    expect(bytes).to.equalBytes(toBuffer(input))
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch via mfs using a provider', async () => {
    let sender: CID | undefined
    const fs = mfs(helia)

    await fs.cp(cid, '/file.txt', {
      providers: [
        kuboInfo.multiaddrs.map(ma => multiaddr(ma))
      ],
      onProgress (evt) {
        if (evt.type === 'helia:block-broker:receive-block') {
          sender = evt.detail.provider
        }
      }
    })

    const bytes = await toBuffer(fs.cat('/file.txt'))

    expect(bytes).to.equalBytes(toBuffer(input))
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })

  it('should fetch via car using a provider', async () => {
    let sender: CID | undefined
    const c = car(helia)

    expect(await toBuffer(
      c.export(cid, {
        providers: [
          kuboInfo.multiaddrs.map(ma => multiaddr(ma))
        ],
        blockFilter: createScalableCuckooFilter(10),
        onProgress (evt) {
          if (evt.type === 'helia:block-broker:receive-block') {
            sender = evt.detail.provider
          }
        }
      }))
    ).to.equalBytes(await toBuffer(
      kubo.api.dag.export(cid)
    ))
    expect(sender).to.deep.equal(peerIdFromString(kuboInfo.peerId?.toString() ?? '').toCID())
  })
})
