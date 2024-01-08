/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { defaultResolver } from '../src/dns-resolvers/default.js'
import { dnsJsonOverHttps } from '../src/dns-resolvers/dns-json-over-https.js'
import { dnsOverHttps } from '../src/dns-resolvers/dns-over-https.js'
import type { DNSResolver } from '../src/index.js'

const resolvers: Record<string, DNSResolver> = {
  'dns-json-over-https': dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
  'dns-over-https': dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
  default: defaultResolver()
}

describe('dns resolvers', () => {
  Object.entries(resolvers).forEach(([name, resolver]) => {
    it(`${name} should resolve`, async () => {
      const result = await resolver('ipfs.io')

      expect(result).to.startWith('/ipfs')
    })

    it(`${name} should cache results`, async function () {
      if (name === 'default' && globalThis.Buffer != null) {
        // node dns uses OS-level caching
        this.skip()
      }

      let usedCache = false

      // resolve once
      await resolver('ipfs.io')

      const makeCall = async (): Promise<void> => {
        await resolver('ipfs.io', {
          onProgress: (evt) => {
            if (evt.type.includes('dnslink:cache')) {
              usedCache = true
            }
          }
        })
      }

      for (let i = 0; i < 15; i++) {
        // resolve again, should use the cache
        // TTL can be pretty low which means this can be flaky if executed more slowly than the TTL
        await makeCall()
        if (usedCache) {
          break
        }
      }

      expect(usedCache).to.be.true()
    })

    it(`${name} should skip cache results`, async function () {
      if (name === 'default' && globalThis.Buffer != null) {
        // node dns uses OS-level caching
        this.skip()
      }

      let usedCache = false

      // resolve once
      await resolver('ipfs.io')

      // resolve again, should skip the cache
      await resolver('ipfs.io', {
        nocache: true,
        onProgress: (evt) => {
          if (evt.type.includes('dnslink:cache')) {
            usedCache = true
          }
        }
      })

      expect(usedCache).to.be.false()
    })

    it(`${name} should abort if signal is aborted`, async () => {
      const signal = AbortSignal.timeout(1)

      await expect(resolver('ipfs.io', { nocache: true, signal })).to.eventually.be.rejected()
    })
  })
})
