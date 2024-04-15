import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import delay from 'delay'
import { CID } from 'multiformats/cid'
import { raceSignal } from 'race-signal'
import Sinon from 'sinon'
import { AbstractSession } from '../src/abstract-session.js'
import type { PeerId } from '@libp2p/interface'
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
}

describe('abstract-session', () => {
  it('should retrieve block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.findNewProviders.callsFake(async function * () {
      yield {
        id: await createEd25519PeerId()
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
      id: await createEd25519PeerId()
    }, {
      id: await createEd25519PeerId()
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
      id: await createEd25519PeerId()
    }, {
      id: await createEd25519PeerId()
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
        id: await createEd25519PeerId()
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
          id: await createEd25519PeerId()
        }
      })(), options.signal)
    })

    await expect(session.retrieve(cid, {
      signal
    })).to.eventually.be.rejected
      .with.property('code', 'ABORT_ERR')
  })

  it('should search for more session providers if the current ones cannot provide the block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: await createEd25519PeerId()
    }, {
      id: await createEd25519PeerId()
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
      id: await createEd25519PeerId()
    }, {
      id: await createEd25519PeerId()
    }]

    session.findNewProviders.onFirstCall().callsFake(async function * () {
      yield providers[0]
    })
    session.findNewProviders.onSecondCall().callsFake(async function * (cid, options) {
      yield raceSignal((async () => {
        await delay(100)

        return {
          id: await createEd25519PeerId()
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
      .with.property('code', 'ABORT_ERR')
  })
})
