import { DEFAULT_SESSION_MAX_PROVIDERS } from '@helia/interface'
import { defaultLogger } from '@libp2p/logger'
import { PeerMap } from '@libp2p/peer-collections'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import delay from 'delay'
import { CID } from 'multiformats/cid'
import pWaitFor from 'p-wait-for'
import { CodeError } from 'protons-runtime'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { createBitswapSession } from '../src/session.js'
import type { Network } from '../src/network.js'
import type { WantList } from '../src/want-list.js'
import type { ComponentLogger } from '@libp2p/interface'

interface StubbedBitswapSessionComponents {
  network: StubbedInstance<Network>
  wantList: StubbedInstance<WantList>
  logger: ComponentLogger
}

describe('session', () => {
  let components: StubbedBitswapSessionComponents
  let cid: CID
  let block: Uint8Array

  beforeEach(() => {
    cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    block = new Uint8Array([0, 1, 2, 3, 4])

    components = {
      network: stubInterface<Network>(),
      wantList: stubInterface<WantList>({
        peers: new PeerMap()
      }),
      logger: defaultLogger()
    }
  })

  it('should create a session', async () => {
    const session = createBitswapSession(components, {})

    // providers found via routing
    const providers = await Promise.all(
      new Array(10).fill(0).map(async (_, i) => {
        return {
          id: await createEd25519PeerId(),
          multiaddrs: [
            multiaddr(`/ip4/4${i}.4${i}.4${i}.4${i}/tcp/${1234 + i}`)
          ]
        }
      })
    )

    components.network.findProviders.withArgs(cid).returns((async function * () {
      for (const prov of providers) {
        yield prov
        await delay(100)
      }
    })())

    // stub first three provider responses, all but #3 have the block, second
    // provider sends the block in the response
    components.wantList.wantSessionBlock.withArgs(cid, providers[0].id).resolves({
      sender: providers[0].id,
      has: true,
      cid
    })
    components.wantList.wantSessionBlock.withArgs(cid, providers[1].id).resolves({
      sender: providers[1].id,
      has: true,
      cid,
      block
    })
    components.wantList.wantSessionBlock.withArgs(cid, providers[3].id).resolves({
      sender: providers[3].id,
      has: true,
      cid
    })
    components.wantList.wantSessionBlock.withArgs(cid, providers[4].id).resolves({
      sender: providers[4].id,
      has: true,
      cid
    })
    components.wantList.wantSessionBlock.withArgs(cid, providers[5].id).resolves({
      sender: providers[5].id,
      has: true,
      cid
    })

    await expect(session.retrieve?.(cid)).to.eventually.deep.equal(block)

    expect(session.providers.length).to.be.lessThan(DEFAULT_SESSION_MAX_PROVIDERS)
    expect([...session.providers].map(p => p.peerId.toString())).to.include(providers[0].id.toString())

    // the query continues after the session is ready
    await pWaitFor(() => {
      return session.providers.length === DEFAULT_SESSION_MAX_PROVIDERS
    })

    // should have stopped at DEFAULT_SESSION_MAX_PROVIDERS
    expect(session.providers.length).to.equal(DEFAULT_SESSION_MAX_PROVIDERS)
  })

  it('should error when creating a session when no peers or providers have the block', async () => {
    const session = createBitswapSession(components, {})

    // no providers found via routing
    components.network.findProviders.withArgs(cid).returns((async function * () {
      yield * []
    })())

    await expect(session.retrieve(cid)).to.eventually.be.rejected
      .with.property('code', 'ERR_INSUFFICIENT_PROVIDERS_FOUND')
  })

  it('should error when creating a session when no providers have the block', async () => {
    // providers found via routing
    const providers = [{
      id: await createEd25519PeerId(),
      multiaddrs: [
        multiaddr('/ip4/41.41.41.41/tcp/1234')
      ]
    }]

    components.network.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    components.wantList.wantSessionBlock.withArgs(cid, providers[0].id).resolves({
      sender: providers[0].id,
      has: false,
      cid
    })

    const session = createBitswapSession(components, {})

    await expect(session.retrieve(cid)).to.eventually.be.rejected
      .with.property('code', 'ERR_INSUFFICIENT_PROVIDERS_FOUND')
  })

  it('should exclude non-bitswap providers from the session', async () => {
    // providers found via routing
    const providers = [{
      id: await createEd25519PeerId(),
      multiaddrs: [
        multiaddr('/ip4/41.41.41.41/tcp/1234')
      ]
    }, {
      id: await createEd25519PeerId(),
      multiaddrs: [
        multiaddr('/ip4/41.41.41.41/tcp/1235')
      ]
    }]

    components.network.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    components.wantList.wantSessionBlock.withArgs(cid, providers[0].id).rejects(new CodeError('Protocol negotiation failed', 'ERR_UNSUPPORTED_PROTOCOL'))
    components.wantList.wantSessionBlock.withArgs(cid, providers[1].id).resolves({
      sender: providers[1].id,
      has: true,
      cid,
      block
    })

    const session = createBitswapSession(components, {})

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)

    // called twice during first query, once during second query
    expect(components.wantList.wantSessionBlock.callCount).to.equal(3)
  })
})
