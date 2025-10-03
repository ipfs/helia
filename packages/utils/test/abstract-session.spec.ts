import { generateKeyPair } from '@libp2p/crypto/keys'
import { isPeerId } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import delay from 'delay'
import { CID } from 'multiformats/cid'
import { raceSignal } from 'race-signal'
import Sinon from 'sinon'
import { AbstractSession } from '../src/abstract-session.js'
import type { PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { ProgressEvent } from 'progress-events'

interface SessionPeer {
  id: PeerId
}

class Session extends AbstractSession<SessionPeer, ProgressEvent> {
  constructor () {
    super({
      logger: defaultLogger()
    }, {
      name: 'test'
    })
  }

  findNewProviders = Sinon.stub()
  queryProvider = Sinon.stub()

  toEvictionKey (prov: SessionPeer): string {
    return prov.id.toString()
  }

  equals (a: SessionPeer, b: SessionPeer): boolean {
    return a.id.equals(b.id)
  }

  async convertToProvider (provider: PeerId | Multiaddr | Multiaddr[]): Promise<SessionPeer | undefined> {
    if (isPeerId(provider)) {
      return {
        id: provider
      }
    }
  }
}

describe('abstract-session', () => {
  it('should retrieve block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.findNewProviders.callsFake(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
      }
    })
    session.queryProvider.withArgs(cid).resolves(block)

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
  })

  it('should request blocks from new providers as they are discovered', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }, {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }]

    session.findNewProviders.callsFake(async function * () {
      yield providers[0]

      // we discover a second provider later on
      await delay(100)
      yield providers[1]
    })
    session.queryProvider.withArgs(cid, providers[0]).callsFake(async () => {
      await delay(500)

      return block
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async () => {
      throw new Error('Did not have block')
    })

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    expect(session.queryProvider.callCount).to.equal(2)
    expect(session.queryProvider.getCall(0).args[1]).to.equal(providers[0])
    expect(session.queryProvider.getCall(1).args[1]).to.equal(providers[1])
  })

  it('should evict session providers', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }, {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }]

    session.findNewProviders.callsFake(async function * () {
      yield * providers
    })
    session.queryProvider.withArgs(cid, providers[0]).callsFake(async () => {
      throw new Error('Urk!')
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async () => {
      return block
    })

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    expect(session.providers.includes(providers[0])).to.be.false()
  })

  it('should join existing CID request', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.findNewProviders.callsFake(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
      }
    })
    session.queryProvider.callsFake(async () => {
      await delay(100)

      return block
    })

    const results = await Promise.all([
      session.retrieve(cid),
      session.retrieve(cid),
      session.retrieve(cid),
      session.retrieve(cid),
      session.retrieve(cid)
    ])

    expect(results).to.have.lengthOf(5)

    for (const result of results) {
      expect(result).to.equal(block)
    }

    expect(session.queryProvider.callCount).to.equal(1)
  })

  it('should abort retrieve if finding initial providers takes too long', async () => {
    const signal = AbortSignal.timeout(10)
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')

    session.findNewProviders.callsFake(async function * (cid, options) {
      yield raceSignal((async () => {
        await delay(100)

        return {
          id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
        }
      })(), options.signal)
    })

    await expect(session.retrieve(cid, {
      signal
    })).to.eventually.be.rejected
      .with.property('name', 'TimeoutError')
  })

  it('should search for more session providers if the current ones cannot provide the block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }, {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }]

    session.findNewProviders.onFirstCall().callsFake(async function * () {
      yield providers[0]
    })
    session.findNewProviders.onSecondCall().callsFake(async function * () {
      yield providers[1]
    })
    session.queryProvider.withArgs(cid, providers[0]).callsFake(async () => {
      throw new Error('Urk!')
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async () => {
      return block
    })

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    expect(session.providers.includes(providers[0])).to.be.false()
  })

  it('should abort retrieve if finding more providers takes too long', async () => {
    const signal = AbortSignal.timeout(10)
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }, {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }]

    session.findNewProviders.onFirstCall().callsFake(async function * () {
      yield providers[0]
    })
    session.findNewProviders.onSecondCall().callsFake(async function * (cid, options) {
      yield raceSignal((async () => {
        await delay(100)

        return {
          id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
        }
      })(), options.signal)
    })
    session.queryProvider.withArgs(cid, providers[0]).callsFake(async () => {
      throw new Error('Urk!')
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async () => {
      return block
    })

    await expect(session.retrieve(cid, {
      signal
    })).to.eventually.be.rejected()
      .with.property('name', 'AbortError')
  })

  it('should not make multiple requests to the only found provider', async function () {
    const session = new Session()
    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const id = peerIdFromPrivateKey(await generateKeyPair('Ed25519')) // same provider

    session.findNewProviders.callsFake(async function * () {
      yield {
        id
      }
    })
    session.queryProvider.callsFake(async () => {
      // always fails
      throw new Error('Urk!')
    })

    await expect(session.retrieve(cid)).to.eventually.be.rejected()

    expect(session.findNewProviders).to.have.property('callCount', 2)
    expect(session.queryProvider).to.have.property('callCount', 1)
  })

  it('should abort retrieve if the signal is aborted before provider returns block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.findNewProviders.onFirstCall().callsFake(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
      }
    })
    session.queryProvider.callsFake(async (cid, provider, options) => {
      return raceSignal((async () => {
        await delay(100)

        return block
      })(), options.signal)
    })

    await expect(session.retrieve(cid, {
      signal: AbortSignal.timeout(10)
    })).to.eventually.be.rejected()
      .with.property('name', 'AbortError')
  })

  it('should handle race condition between finding block and abort signal', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }, {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    }]

    session.findNewProviders.callsFake(async function * () {
      yield providers[0]
      yield providers[1]
    })
    const abortDelay = 500

    session.queryProvider.withArgs(cid, providers[0]).callsFake(async (_cid, _provider, options) => {
      return raceSignal((async () => {
        await delay(abortDelay * 2) // always takes longer than abortDelay

        return Uint8Array.from([0, 1, 2, 3, 4])
      })(), options.signal)
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async (_cid, _provider, options) => {
      return raceSignal((async () => {
        await delay(abortDelay - 40)

        return block
      })(), options.signal)
    })

    await expect(session.retrieve(cid, {
      signal: AbortSignal.timeout(abortDelay)
    })).to.eventually.deep.equal(block)

    expect(session.queryProvider.callCount).to.equal(2)
  })
})
