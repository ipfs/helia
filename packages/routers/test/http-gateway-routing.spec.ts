import { expect } from 'aegir/chai'
import all from 'it-all'
import { CID } from 'multiformats'
import { httpGatewayRouting } from '../src/http-gateway-routing.js'

describe('http-gateway-routing', () => {
  it('should find providers', async () => {
    const gateway = 'https://example.com'
    const routing = httpGatewayRouting({
      gateways: [
        gateway
      ]
    })

    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')

    const providers = await all(routing.findProviders?.(cid) ?? [])

    expect(providers).to.have.lengthOf(1)
    expect(providers).to.have.nested.property('[0].protocols').that.includes('transport-ipfs-gateway-http')
    expect(providers[0].multiaddrs.map(ma => ma.toString())).to.include('/dns4/example.com/tcp/443/https')
  })

  it('should shuffle providers by default', async () => {
    // long enough to make a false positive very unlikely, 1/(10!)
    const gateways = Array.from({ length: 10 }, (_, i) => `https://example${i + 1}.com`)
    const routing = httpGatewayRouting({ gateways })

    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')

    const providers = await all(routing.findProviders?.(cid) ?? [])

    const originalOrder = gateways.map(gw => `/dns4/${gw.replace('https://', '')}/tcp/443/https`)
    const shuffledOrder = providers.map(p => p.multiaddrs.map(ma => ma.toString())[0])
    expect(shuffledOrder).to.not.deep.equal(originalOrder)
  })

  it('should preserve provider order when shuffle is false', async () => {
    // long enough to make a false positive very unlikely, 1/(10!)
    const gateways = Array.from({ length: 10 }, (_, i) => `https://example${i + 1}.com`)

    const routing = httpGatewayRouting({
      gateways,
      shuffle: false
    })

    const cid = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')

    const providers = await all(routing.findProviders?.(cid) ?? [])

    const expected = gateways.map(gw => `/dns4/${gw.replace('https://', '')}/tcp/443/https`)
    const actual = providers.map(p => p.multiaddrs.map(ma => ma.toString())[0])
    expect(actual).to.deep.equal(expected)
  })
})
