import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import Sinon from 'sinon'
import { createVerifiedFetch } from '../src/index.js'
import { VerifiedFetch } from '../src/verified-fetch.js'
import { createHelia } from './fixtures/create-offline-helia.js'
import type { Helia } from '@helia/interface'

describe('custom dns-resolvers', () => {
  let helia: Helia

  beforeEach(async () => {
    helia = await createHelia()
  })

  afterEach(async () => {
    await stop(helia)
  })

  it('is used when passed to createVerifiedFetch', async () => {
    const customDnsResolver = Sinon.stub()

    customDnsResolver.returns(Promise.resolve('/ipfs/QmVP2ip92jQuMDezVSzQBWDqWFbp9nyCHNQSiciRauPLDg'))

    const fetch = await createVerifiedFetch(helia, {
      dnsResolvers: [customDnsResolver]
    })
    // error of walking the CID/dag because we haven't actually added the block to the blockstore
    await expect(fetch('ipns://some-non-cached-domain.com')).to.eventually.be.rejected.with.property('errors').that.has.lengthOf(0)

    expect(customDnsResolver.callCount).to.equal(1)
    expect(customDnsResolver.getCall(0).args).to.deep.equal(['some-non-cached-domain.com', { onProgress: undefined }])
  })

  it('is used when passed to VerifiedFetch', async () => {
    const customDnsResolver = Sinon.stub()

    customDnsResolver.returns(Promise.resolve('/ipfs/QmVP2ip92jQuMDezVSzQBWDqWFbp9nyCHNQSiciRauPLDg'))

    const verifiedFetch = new VerifiedFetch({
      helia
    }, {
      dnsResolvers: [customDnsResolver]
    })
    // error of walking the CID/dag because we haven't actually added the block to the blockstore
    await expect(verifiedFetch.fetch('ipns://some-non-cached-domain2.com')).to.eventually.be.rejected.with.property('errors').that.has.lengthOf(0)

    expect(customDnsResolver.callCount).to.equal(1)
    expect(customDnsResolver.getCall(0).args).to.deep.equal(['some-non-cached-domain2.com', { onProgress: undefined }])
  })
})
