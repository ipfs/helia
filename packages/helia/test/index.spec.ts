import { expect } from 'aegir/chai'
import drain from 'it-drain'
import toBuffer from 'it-to-buffer'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { stubInterface } from 'sinon-ts'
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

  it('should add a block broker', async () => {
    const block = crypto.getRandomValues(new Uint8Array(32))
    const cid = CID.createV0(await sha256.digest(block))

    await expect(drain(helia.blockstore.get(cid, {
      signal: AbortSignal.timeout(100)
    }))).to.eventually.be.rejected()

    helia.addBlockBroker({
      name: 'test-broker',
      retrieve: async () => {
        return block
      }
    })

    await expect(toBuffer(helia.blockstore.get(cid)))
      .to.eventually.deep.equal(block)
  })

  it('should add a block broker as a factory', async () => {
    const block = crypto.getRandomValues(new Uint8Array(32))
    const cid = CID.createV0(await sha256.digest(block))

    await expect(drain(helia.blockstore.get(cid, {
      signal: AbortSignal.timeout(100)
    }))).to.eventually.be.rejected()

    helia.addBlockBroker(() => ({
      name: 'test-broker',
      retrieve: async () => {
        return block
      }
    }))

    await expect(toBuffer(helia.blockstore.get(cid)))
      .to.eventually.deep.equal(block)
  })

  it.skip('should add a router', async () => {
    const block = crypto.getRandomValues(new Uint8Array(32))
    const cid = CID.createV0(await sha256.digest(block))

    const router = stubInterface({
      name: 'test-broker',
      findProviders: async function * () {}
    })

    helia.addRouter(router)

    await expect(drain(helia.blockstore.get(cid, {
      signal: AbortSignal.timeout(1_000)
    }))).to.eventually.be.rejected()

    expect(router.findProviders.called).to.be.true()
  })

  it.skip('should add a router as a factory', async () => {
    const block = crypto.getRandomValues(new Uint8Array(32))
    const cid = CID.createV0(await sha256.digest(block))

    const router = stubInterface({
      name: 'test-broker',
      findProviders: async function * () {}
    })

    helia.addRouter(() => router)

    await expect(drain(helia.blockstore.get(cid, {
      signal: AbortSignal.timeout(1_000)
    }))).to.eventually.be.rejected()

    expect(router.findProviders.called).to.be.true()
  })
})
