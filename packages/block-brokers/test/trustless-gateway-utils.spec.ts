import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { filterNonHTTPMultiaddrs } from '../src/trustless-gateway/utils.js'

describe('trustless-gateway-block-broker-utils', () => {
  it('filterNonHTTPMultiaddrs respects allowInsecure multiaddrs correctly', async function () {
    const nonSecureMaddr = uriToMultiaddr('http://mygw.com')
    const secureMaddr = uriToMultiaddr('https://mygw.com')

    const filtered = filterNonHTTPMultiaddrs([nonSecureMaddr, secureMaddr], true, true)

    expect(filtered.length).to.deep.equal(2)
  })

  it('filterNonHTTPMultiaddrs filters local multiaddrs correctly', async function () {
    const localMaddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localMaddr], true, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs filters multiaddrs correctly', async function () {
    const localMaddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localMaddr], false, false)

    expect(filtered.length).to.deep.equal(0)
  })

  it('filterNonHTTPMultiaddrs allows 127.0.0.1 when allowInsecure=false', async function () {
    const localMaddr = uriToMultiaddr('http://127.0.0.1')

    const filtered = filterNonHTTPMultiaddrs([localMaddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs allows localhost when allowInsecure=false', async function () {
    const localMaddr = uriToMultiaddr('http://localhost')

    const filtered = filterNonHTTPMultiaddrs([localMaddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })

  it('filterNonHTTPMultiaddrs allows *.localhost when allowInsecure=false', async function () {
    const localMaddr = uriToMultiaddr('http://example.localhost')

    const filtered = filterNonHTTPMultiaddrs([localMaddr], false, true)

    expect(filtered.length).to.deep.equal(1)
  })
})
