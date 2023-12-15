/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHeliaHTTP } from '../src/index.js'
import type { HeliaHTTP } from '@helia/interface/http'

describe('helia', () => {
  let heliaHTTP: HeliaHTTP

  beforeEach(async () => {
    heliaHTTP = await createHeliaHTTP({
      datastore: new MemoryDatastore(),
      blockstore: new MemoryBlockstore()
    })
  })

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop()
    }
  })

  it('stops and starts', async () => {
    // TODO(DJ: Find another way to check these states

    expect(heliaHTTP.libp2p.status).to.equal('started')

    await heliaHTTP.stop()

    expect(heliaHTTP.libp2p.status).to.equal('stopped')
  })

  it('should have a blockstore', async () => {
    expect(heliaHTTP).to.have.property('blockstore').that.is.ok()
  })

  it('should have a datastore', async () => {
    expect(heliaHTTP).to.have.property('datastore').that.is.ok()
  })

  it('should have not a libp2p', async () => {
    expect(heliaHTTP).to.have.property('libp2p').that.is.not.ok()
  })
})
