import Resolver from 'dns-over-http-resolver'
import PQueue from 'p-queue'
import { CustomProgressEvent } from 'progress-events'
import { resolveFn, type DNSResponse } from '../utils/dns.js'
import { TLRU } from '../utils/tlru.js'
import type { DNSResolver } from '../index.js'

const cache = new TLRU<string>(1000)
// We know browsers themselves cache DNS records for at least 1 minute,
// which acts a provisional default ttl: https://stackoverflow.com/a/36917902/11518426
const ttl = 60 * 1000

// browsers limit concurrent connections per host,
// we don't want to exhaust the limit (~6)
const httpQueue = new PQueue({ concurrency: 4 })

const resolve: DNSResolver = async function resolve (domain, options = {}) {
  const resolver = new Resolver({ maxCache: 0 })
  // try cache first
  if (options.nocache !== true && cache.has(domain)) {
    const response = cache.get(domain)

    if (response != null) {
      options?.onProgress?.(new CustomProgressEvent<string>('dnslink:cache', { detail: response }))
      return response
    }
  }

  options.onProgress?.(new CustomProgressEvent<string>('dnslink:query', { detail: domain }))

  // Add the query to the queue
  const response = await httpQueue.add(async () => {
    const dnslinkRecord = await resolveFn(resolver, domain)

    options.onProgress?.(new CustomProgressEvent<DNSResponse>('dnslink:answer', { detail: dnslinkRecord }))
    cache.set(domain, dnslinkRecord, ttl)

    return dnslinkRecord
  }, {
    signal: options?.signal
  })

  if (response == null) {
    throw new Error('No DNS response received')
  }

  return response
}

export default resolve
