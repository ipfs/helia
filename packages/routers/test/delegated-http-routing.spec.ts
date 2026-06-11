import { defaultLogger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { CID } from 'multiformats/cid'
import { stubInterface } from 'sinon-ts'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { delegatedHTTPRouting } from '../src/index.ts'
import type { DelegatedRoutingV1HttpApiClient, PeerRecord } from '@helia/delegated-routing-v1-http-api-client'
import type { Routing } from '@helia/interface'
import type { StubbedInstance } from 'sinon-ts'

describe('delegated-http-routing', () => {
  let client: StubbedInstance<DelegatedRoutingV1HttpApiClient>
  let router: Routing

  beforeEach(() => {
    client = stubInterface<DelegatedRoutingV1HttpApiClient>()

    router = delegatedHTTPRouting({
      url: 'http://127.0.0.1'
    })({
      logger: defaultLogger()
    })
    // @ts-expect-error private field
    router.client = client
  })

  it.skip('should provide', async () => {
    // this is a no-op
  })

  it('should find providers', async () => {
    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')
    const options = {}

    const providers: PeerRecord[] = [{
      ID: peerIdFromString('12D3KooWPPMkhpoWGA7WRUL8jDGduGT486aE3hHEf6sfDq8hTaFJ'),
      Schema: 'peer',
      Protocols: ['transport-bitswap'],
      Addrs: []
    }]

    client.getProviders.returns(async function * () {
      yield * providers
    }())

    await drain(router.findProviders(cid, options))

    expect(client.getProviders.calledWith(cid, options)).to.be.true()
  })

  it('should put a IPNS record value', async () => {
    const key = uint8ArrayConcat([
      uint8ArrayFromString('/ipns/'),
      CID.parse('k51qzi5uqu5dm0ntxloxmkd7w0snw9b13x9tveslq3r8v0i10z2inerg32k8mx').multihash.bytes
    ])
    const value = Uint8Array.from([5, 6, 7, 8, 9])
    const options = {}

    await router.put(key, value, options)

    expect(client.putIPNS.called).to.be.true()
  })

  it('should not put a non-IPNS record value', async () => {
    const key = Uint8Array.from([0, 1, 2, 3, 4])
    const value = Uint8Array.from([5, 6, 7, 8, 9])
    const options = {}

    await router.put(key, value, options)

    expect(client.putIPNS.called).to.be.false()
  })

  it('should get a IPNS record value', async () => {
    const key = uint8ArrayConcat([
      uint8ArrayFromString('/ipns/'),
      CID.parse('k51qzi5uqu5dm0ntxloxmkd7w0snw9b13x9tveslq3r8v0i10z2inerg32k8mx').multihash.bytes
    ])
    const value = Uint8Array.from([5, 6, 7, 8, 9])
    const options = {}

    client.getIPNS.resolves(value)

    await router.get(key, options)

    expect(client.getIPNS.called).to.be.true()
  })

  it('should not get a non-IPNS record value', async () => {
    const key = Uint8Array.from([0, 1, 2, 3, 4])
    const options = {}

    await expect(router.get(key, options)).to.eventually.be.rejected
      .with.property('name', 'NotFoundError')

    expect(client.getIPNS.called).to.be.false()
  })

  it('should find a peer', async () => {
    const peerId = peerIdFromString('12D3KooWPPMkhpoWGA7WRUL8jDGduGT486aE3hHEf6sfDq8hTaFJ')
    const options = {}

    const peers: PeerRecord[] = [{
      ID: peerId,
      Schema: 'peer',
      Protocols: ['transport-bitswap'],
      Addrs: []
    }]

    client.getPeers.returns(async function * () {
      yield * peers
    }())

    await router.findPeer(peerId.toCID(), options)

    expect(client.getPeers.called).to.be.true()
  })

  it.skip('should get closest peers', async () => {
    // this is a no-op
  })
})
