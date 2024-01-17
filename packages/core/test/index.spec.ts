/* eslint-env mocha */
import { expect } from 'aegir/chai'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { createHelia } from './fixtures/create-helia.js'
import type { Helia, Routing } from '@helia/interface'
import type { Startable } from '@libp2p/interface'

describe('helia', () => {
  let helia: Helia
  let routing: Routing

  beforeEach(async () => {
    routing = stubInterface<Routing & Startable>({
      start: Sinon.stub(),
      stop: Sinon.stub()
    })
    helia = await createHelia({
      start: false,
      routers: [
        routing
      ]
    })
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('stops and starts', async () => {
    expect(routing).to.have.nested.property('start.called', false)

    await helia.start()

    expect(routing).to.have.nested.property('start.called', true)
    expect(routing).to.have.nested.property('stop.called', false)

    await helia.stop()

    expect(routing).to.have.nested.property('stop.called', true)
  })

  it('should have a blockstore', async () => {
    expect(helia).to.have.property('blockstore').that.is.ok()
  })

  it('should have a datastore', async () => {
    expect(helia).to.have.property('datastore').that.is.ok()
  })
})
