/* eslint-env browser */

import { Buffer } from 'buffer'
import dnsPacket, { type DecodedPacket } from 'dns-packet'
import { base64url } from 'multiformats/bases/base64'
import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { type DNSResponse, MAX_RECURSIVE_DEPTH, recursiveResolveDnslink, ipfsPathAndAnswer } from '../utils/dns.js'
import { TLRU } from '../utils/tlru.js'
import type { ResolveDnsLinkOptions, DNSResolver } from '../index.js'

// Avoid sending multiple queries for the same hostname by caching results
const cache = new TLRU<string>(1000)
// This TTL will be used if the remote service does not return one
const ttl = 60 * 1000

/**
 * Uses the RFC 1035 'application/dns-message' content-type to resolve DNS
 * queries.
 *
 * This resolver needs more dependencies than the non-standard
 * DNS-JSON-over-HTTPS resolver so can result in a larger bundle size and
 * consequently is not preferred for browser use.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc1035
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-wireformat/
 * @see https://github.com/curl/curl/wiki/DNS-over-HTTPS#publicly-available-servers
 * @see https://dnsprivacy.org/public_resolvers/
 */
export function dnsOverHttps (url: string): DNSResolver {
  // browsers limit concurrent connections per host,
  // we don't want preload calls to exhaust the limit (~6)
  const httpQueue = new PQueue({ concurrency: 4 })

  const resolve = async (fqdn: string, options: ResolveDnsLinkOptions = {}): Promise<string> => {
    const dnsQuery = dnsPacket.encode({
      type: 'query',
      id: 0,
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{
        type: 'TXT',
        name: fqdn
      }]
    })

    const searchParams = new URLSearchParams()
    searchParams.set('dns', base64url.encode(dnsQuery).substring(1))

    const query = searchParams.toString()

    // try cache first
    if (options.nocache !== true && cache.has(query)) {
      const response = cache.get(query)

      if (response != null) {
        options.onProgress?.(new CustomProgressEvent<string>('dnslink:cache', { detail: response }))
        return response
      }
    }

    options.onProgress?.(new CustomProgressEvent<string>('dnslink:query', { detail: fqdn }))

    // query DNS over HTTPS server
    const response = await httpQueue.add(async () => {
      const res = await fetch(`${url}?${searchParams}`, {
        headers: {
          accept: 'application/dns-message'
        },
        signal: options.signal
      })

      if (res.status !== 200) {
        throw new Error(`Unexpected HTTP status: ${res.status} - ${res.statusText}`)
      }

      const query = new URL(res.url).search.slice(1)
      const buf = await res.arrayBuffer()
      // map to expected response format
      const json = toDNSResponse(dnsPacket.decode(Buffer.from(buf)))

      options.onProgress?.(new CustomProgressEvent<DNSResponse>('dnslink:answer', { detail: json }))

      const { ipfsPath, answer } = ipfsPathAndAnswer(fqdn, json)

      cache.set(query, ipfsPath, answer.TTL ?? ttl)

      return ipfsPath
    }, {
      signal: options.signal
    })

    if (response == null) {
      throw new Error('No DNS response received')
    }

    return response
  }

  return async (domain: string, options: ResolveDnsLinkOptions = {}) => {
    return recursiveResolveDnslink(domain, MAX_RECURSIVE_DEPTH, resolve, options)
  }
}

function toDNSResponse (response: DecodedPacket): DNSResponse {
  const txtType = 16

  return {
    Status: 0,
    TC: response.flag_tc ?? false,
    RD: response.flag_rd ?? false,
    RA: response.flag_ra ?? false,
    AD: response.flag_ad ?? false,
    CD: response.flag_cd ?? false,
    Question: response.questions?.map(q => ({
      name: q.name,
      type: txtType
    })) ?? [],
    Answer: response.answers?.map(a => {
      if (a.type !== 'TXT' || a.data.length < 1) {
        return {
          name: a.name,
          type: txtType,
          TTL: 0,
          data: 'invalid'
        }
      }

      if (!Buffer.isBuffer(a.data[0])) {
        return {
          name: a.name,
          type: txtType,
          TTL: a.ttl ?? ttl,
          data: String(a.data[0])
        }
      }

      return {
        name: a.name,
        type: txtType,
        TTL: a.ttl ?? ttl,
        data: uint8ArrayToString(a.data[0])
      }
    }) ?? []
  }
}
