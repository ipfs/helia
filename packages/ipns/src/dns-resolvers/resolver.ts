import { Resolver } from 'dns/promises'
import { CustomProgressEvent } from 'progress-events'
import { resolveFn, type DNSResponse } from '../utils/dns.js'
import type { DNSResolver } from '../index.js'

const resolve: DNSResolver = async function resolve (domain, options = {}) {
  const resolver = new Resolver()
  const listener = (): void => {
    resolver.cancel()
  }

  options.signal?.addEventListener('abort', listener)

  try {
    options.onProgress?.(new CustomProgressEvent<string>('dnslink:query', { detail: domain }))
    const dnslinkRecord = await resolveFn(resolver, domain)

    options.onProgress?.(new CustomProgressEvent<DNSResponse>('dnslink:answer', { detail: dnslinkRecord }))
    return dnslinkRecord
  } finally {
    options.signal?.removeEventListener('abort', listener)
  }
}

export default resolve
