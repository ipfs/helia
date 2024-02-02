/* eslint-env mocha */
import { createHeliaHTTP } from '@helia/http'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import { createVerifiedFetch } from '../src/index.js'

describe('createVerifiedFetch', () => {
  it('can be constructed with a HeliaHttp instance', async () => {
    const heliaHttp = await createHeliaHTTP()
    const verifiedFetch = await createVerifiedFetch(heliaHttp)

    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  it('can be constructed with a HeliaP2P instance', async () => {
    const heliaP2P = await createHelia()
    const verifiedFetch = await createVerifiedFetch(heliaP2P)

    expect(verifiedFetch).to.be.ok()
    await heliaP2P.stop()
    await verifiedFetch.stop()
  })

  it('can be constructed with gateways', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: ['https://127.0.0.1']
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  it('can be constructed with gateways & routers', async () => {
    const verifiedFetch = await createVerifiedFetch({
      gateways: ['https://127.0.0.1'],
      routers: ['https://127.0.0.1']
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })
})
