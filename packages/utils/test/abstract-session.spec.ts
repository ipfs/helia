import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import delay from 'delay'
import { CID } from 'multiformats/cid'
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
  includeProvider = Sinon.stub()
}

describe('abstract-session', () => {
  it('should retrieve block', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.includeProvider.returns(true)
    session.findNewProviders.callsFake(async () => {
      session.providers.push({
        id: await createEd25519PeerId()
      })
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

    session.includeProvider.returns(true)
    session.findNewProviders.callsFake(async () => {
      session.providers.push(providers[0])

      // we discover a second provider later on
      setTimeout(() => {
        session.providers.push(providers[1])

        session.safeDispatchEvent('provider', {
          detail: providers[1]
        })
      }, 100)
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

  it('should filter session providers', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    const providers: SessionPeer[] = [{
      id: await createEd25519PeerId()
    }, {
      id: await createEd25519PeerId()
    }]

    session.includeProvider.withArgs(providers[0]).returns(false)
    session.includeProvider.withArgs(providers[1]).returns(true)
    session.findNewProviders.callsFake(async () => {
      session.providers.push(...providers)
    })
    session.queryProvider.withArgs(cid, providers[0]).callsFake(async () => {
      return block
    })
    session.queryProvider.withArgs(cid, providers[1]).callsFake(async () => {
      return block
    })

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    expect(session.queryProvider.callCount).to.equal(1)
    expect(session.queryProvider.getCall(0).args[1]).to.equal(providers[1])
  })

  it('should join existing CID request', async () => {
    const session = new Session()

    const cid = CID.parse('bafybeifaymukvfkyw6xgh4th7tsctiifr4ea2btoznf46y6b2fnvikdczi')
    const block = Uint8Array.from([0, 1, 2, 3])

    session.includeProvider.returns(true)
    session.findNewProviders.callsFake(async () => {
      session.providers.push({
        id: await createEd25519PeerId()
      })
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
})
