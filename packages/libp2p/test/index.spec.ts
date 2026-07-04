import { expect } from 'aegir/chai'
import { defaultLogger } from 'birnam'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p, isLibp2p } from 'libp2p'
import { stubInterface } from 'sinon-ts'
import { withLibp2p } from '../src/index.ts'
import type { HeliaWithLibp2p } from '../src/index.ts'
import type { StubbedInstance } from 'sinon-ts'

describe('@helia/libp2p', () => {
  let helia: StubbedInstance<HeliaWithLibp2p<any>>

  beforeEach(() => {
    helia = withLibp2p(stubInterface<any>({
      datastore: new MemoryDatastore(),
      logger: defaultLogger(),
      routing: stubInterface()
    }))
  })

  afterEach(async () => {
    await helia.addMixin.getCall(0).args[0]?.stop?.(helia)
  })

  it('should add a mixin', async () => {
    expect(helia.addMixin.callCount).to.equal(1)
  })

  it('should add a libp2p property', async () => {
    await helia.addMixin.getCall(0).args[0]?.start?.(helia)
    expect(isLibp2p(helia.libp2p)).to.be.true()
  })

  it('allows passing a libp2p node', async () => {
    const libp2p = await createLibp2p()

    helia = withLibp2p(stubInterface<any>({
      datastore: new MemoryDatastore(),
      logger: defaultLogger(),
      routing: stubInterface()
    }), libp2p)

    await helia.addMixin.getCall(0).args[0]?.start?.(helia)

    expect(helia.libp2p).to.equal(libp2p)
  })
})
