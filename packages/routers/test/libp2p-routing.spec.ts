import { peerIdFromString } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { CID } from 'multiformats'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { libp2pRouting } from '../src/index.js'
import type { Routing } from '@helia/interface'
import type { ContentRouting, Libp2p, PeerRouting } from '@libp2p/interface'

describe('libp2p-routing', () => {
  let libp2p: StubbedInstance<Libp2p>
  let contentRouting: StubbedInstance<ContentRouting>
  let peerRouting: StubbedInstance<PeerRouting>
  let router: Routing

  beforeEach(() => {
    contentRouting = stubInterface<ContentRouting>()
    peerRouting = stubInterface<PeerRouting>()
    libp2p = stubInterface<Libp2p>({
      contentRouting,
      peerRouting
    })

    router = libp2pRouting(libp2p)
  })

  it('should call through to contentRouting.provide', async () => {
    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')
    const options = {}

    await router.provide(cid, options)

    expect(contentRouting.provide.calledWith(cid, options)).to.be.true()
  })

  it('should call through to contentRouting.findProviders', async () => {
    contentRouting.findProviders.returns(async function * () {}())

    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')
    const options = {}

    await drain(router.findProviders(cid, options))

    expect(contentRouting.findProviders.calledWith(cid, options)).to.be.true()
  })

  it('should call through to contentRouting.put', async () => {
    const key = Uint8Array.from([0, 1, 2, 3, 4])
    const value = Uint8Array.from([5, 6, 7, 8, 9])
    const options = {}

    await router.put(key, value, options)

    expect(contentRouting.put.calledWith(key, value, options)).to.be.true()
  })

  it('should call through to contentRouting.get', async () => {
    const key = Uint8Array.from([0, 1, 2, 3, 4])
    const options = {}

    await router.get(key, options)

    expect(contentRouting.get.calledWith(key, options)).to.be.true()
  })

  it('should call through to peerRouting.findPeer', async () => {
    const peerId = peerIdFromString('12D3KooWPPMkhpoWGA7WRUL8jDGduGT486aE3hHEf6sfDq8hTaFJ')
    const options = {}

    await router.findPeer(peerId, options)

    expect(peerRouting.findPeer.calledWith(peerId, options)).to.be.true()
  })

  it('should call through to peerRouting.getClosestPeers', async () => {
    peerRouting.getClosestPeers.returns(async function * () {}())

    const key = Uint8Array.from([0, 1, 2, 3, 4])
    const options = {}

    await drain(router.getClosestPeers(key, options))

    expect(peerRouting.getClosestPeers.calledWith(key, options)).to.be.true()
  })
})
