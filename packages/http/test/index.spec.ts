import { expect } from 'aegir/chai'
import { stubInterface } from 'sinon-ts'
import { withHTTP } from '../src/index.ts'
import type { Helia } from '@helia/interface'
import type { StubbedInstance } from 'sinon-ts'

describe('@helia/http', () => {
  let helia: StubbedInstance<Helia>

  beforeEach(async () => {
    helia = withHTTP(stubInterface())
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('adds routers', async () => {
    expect(helia.addRouter.callCount).to.equal(2)
  })

  it('adds block brokers', async () => {
    expect(helia.addBlockBroker.callCount).to.equal(1)
  })
})
