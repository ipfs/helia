import { expect } from 'aegir/chai'
import { createHelia } from '../src/index.ts'
import type { Helia } from '@helia/interface'

describe('helia', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia().start()
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('stops and starts', async () => {
    expect(helia.status).to.equal('started')

    await helia.stop()

    expect(helia.status).to.equal('stopped')
  })

  it('should have a blockstore', async () => {
    expect(helia).to.have.property('blockstore').that.is.ok()
  })

  it('should have a datastore', async () => {
    expect(helia).to.have.property('datastore').that.is.ok()
  })
})
