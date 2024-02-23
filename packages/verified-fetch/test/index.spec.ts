import { createHeliaHTTP } from '@helia/http'
import { dnsJsonOverHttps, dnsOverHttps } from '@helia/ipns/dns-resolvers'
import { expect } from 'aegir/chai'
import { createHelia } from 'helia'
import { createVerifiedFetch, verifiedFetch } from '../src/index.js'

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

  it('can be constructed with no options', async () => {
    const verifiedFetch = await createVerifiedFetch()

    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  it('can be used as a singleton', () => {
    expect(verifiedFetch).to.be.a('function')
    expect(verifiedFetch.stop).to.be.a('function')
    expect(verifiedFetch.start).to.be.a('function')
  })

  it('can be passed a contentTypeParser', async () => {
    const contentTypeParser = (_bytes: Uint8Array): string => 'application/json'
    const verifiedFetch = await createVerifiedFetch(undefined, {
      contentTypeParser
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })

  it('can be passed custom dnsResolvers', async () => {
    const dnsResolver = dnsOverHttps('https://example.com/dns-query')
    const dnsJsonResolver = dnsJsonOverHttps('https://example.com/dns-json')
    const verifiedFetch = await createVerifiedFetch(undefined, {
      dnsResolvers: [dnsResolver, dnsJsonResolver]
    })
    expect(verifiedFetch).to.be.ok()
    await verifiedFetch.stop()
  })
})
