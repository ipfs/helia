/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHeliaHTTP } from '../src/index.js'
import type { Helia } from '@helia/interface'

describe('helia', () => {
  let heliaHTTP: Helia

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

  it('should have a libp2p', async () => {
    expect(heliaHTTP).to.have.property('libp2p').that.is.ok()
  })
})
