import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { filterNonHTTPMultiaddrs } from '../src/trustless-gateway/utils.js'

describe('trustless-gateway-block-broker-utils', () => {
  it('filterNonHTTPMultiaddrs respects allowInsecure multiaddrs correctly', async function () {
    const nonSecureAddr = uriToMultiaddr('http://mygw.com')
    const secureAddr = uriToMultiaddr('https://mygw.com')

    const filtered = filterNonHTTPMultiaddrs([nonSecureAddr, secureAddr], true, true)

    expect(filtered.length).to.deep.equal(2)
  })

  it('filterNonHTTPMultiaddrs filters local multiaddrs correctly', async function () {
    const localAddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localAddr], true, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs filters multiaddrs correctly', async function () {
    const localAddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localAddr], false, false)

    expect(filtered.length).to.deep.equal(0)
  })

  it('filterNonHTTPMultiaddrs allows 127.0.0.1 when allowInsecure=false', async function () {
    const localAddr = uriToMultiaddr('http://127.0.0.1')

    const filtered = filterNonHTTPMultiaddrs([localAddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs allows localhost when allowInsecure=false', async function () {
    const localAddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localAddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs allows *.localhost when allowInsecure=false', async function () {
    const localAddr = uriToMultiaddr('http://example.localhost')

    const filtered = filterNonHTTPMultiaddrs([localAddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })
})
