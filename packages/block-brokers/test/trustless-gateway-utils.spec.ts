import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { filterNonHTTPMultiaddrs, limitedResponse } from '../src/trustless-gateway/utils.js'

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

  it('limitedResponse throws an error when the content-length header is greater than the limit', async function () {
    const response = new Response('x'.repeat(1_000_000), {
      headers: {
        'content-length': '1000000'
      }
    })

    await expect(limitedResponse(response, 100)).to.eventually.be.rejected
      .with.property('message', 'Content-Length header (1000000) is greater than the limit (100).')
  })

  it('limitedResponse throws an error when the response body is greater than the limit', async function () {
    const response = new Response('x'.repeat(1_000_000), {
      headers: {
        'content-length': '100'
      }
    })

    await expect(limitedResponse(response, 100)).to.eventually.be.rejected
      .with.property('message', 'Response body is greater than the limit (100), received 1000000 bytes.')
  })

  it('limitedResponse handles aborted signals', async function () {
    const abortController = new AbortController()
    let pullCount = 0
    const textEncoder = new TextEncoder()

    const responseBody = new ReadableStream({
      start (controller) {
        controller.enqueue(textEncoder.encode('x'))
      },
      pull (controller) {
        pullCount++
        controller.enqueue(textEncoder.encode('x'))
        if (!abortController.signal.aborted && pullCount === 2) {
          abortController.abort()
        }
      },
      cancel (controller) {
        controller.close()
      }
    })

    await expect(limitedResponse(new Response(responseBody, {
      headers: {
        'content-length': '1000000'
      }
    }), 1_000_000, { signal: abortController.signal })).to.eventually.be.rejected
      .with.property('message', 'Response body read was aborted.')
  })
})
