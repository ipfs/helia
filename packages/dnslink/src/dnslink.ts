import { MAX_RECURSIVE_DEPTH, RecordType } from '@multiformats/dns'
import QuickLRU from 'quick-lru'
import { CACHE_MAX_AGE, CACHE_MAX_ANSWERS, CACHE_SIZE } from './constants.ts'
import { DNSLinkNotFoundError } from './errors.js'
import { ipfs } from './namespaces/ipfs.ts'
import { ipns } from './namespaces/ipns.ts'
import type { DNSLink as DNSLinkInterface, ResolveDNSLinkOptions, DNSLinkOptions, DNSLinkComponents, DNSLinkParser, DNSLinkResolveResult } from './index.js'
import type { Logger } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'

export class DNSLink <Namespaces extends Record<string, DNSLinkParser<DNSLinkResolveResult>>> implements DNSLinkInterface<ReturnType<Namespaces[keyof Namespaces]>> {
  private readonly dns: DNS
  private readonly log: Logger
  private readonly namespaces: Record<string, DNSLinkParser<any>>
  private readonly cache: QuickLRU<string, QuickLRU<number, ReturnType<Namespaces[keyof Namespaces]>>>
  private readonly cacheMaxAnswers: number

  constructor (components: DNSLinkComponents, init: DNSLinkOptions<Namespaces> = {}) {
    this.dns = components.dns
    this.log = components.logger.forComponent('helia:dnslink')
    this.namespaces = {
      ipfs,
      ipns,
      ...init.namespaces
    }
    this.cache = new QuickLRU({
      maxSize: init.cacheSize ?? CACHE_SIZE,
      maxAge: init.cacheMaxAge ?? CACHE_MAX_AGE
    })
    this.cacheMaxAnswers = init.cacheMaxAnswers ?? CACHE_MAX_ANSWERS
  }

  async resolve (domain: string, options: ResolveDNSLinkOptions = {}): Promise<Array<ReturnType<Namespaces[keyof Namespaces]>>> {
    if (options.nocache !== true) {
      // check the cache if allowed
      const cached = this.cache.get(domain)

      if (cached != null) {
        const answers = [...cached.values()]

        if (answers.length > 0) {
          return answers
        }
      }
    }

    const result = await this.recursiveResolveDomain(domain, options.maxRecursiveDepth ?? MAX_RECURSIVE_DEPTH, options)

    // cache answers according to individual TTLs
    const cache = new QuickLRU<number, ReturnType<Namespaces[keyof Namespaces]>>({
      maxSize: this.cacheMaxAnswers
    })

    result.forEach((result, index) => {
      cache.set(index, result, {
        maxAge: (result.answer.TTL * 1000)
      })
    })

    // find longest answer TTL
    let maxTTL = result.reduce((acc, curr) => {
      const ttl = (curr.answer.TTL * 1000)

      if (ttl > acc) {
        return ttl
      }

      return acc
    }, 0)

    // if the configured max age is less than the longest answer TTL, use that
    // instead
    if (this.cache.maxAge < maxTTL) {
      maxTTL = this.cache.maxAge
    }

    this.cache.set(domain, cache, {
      maxAge: maxTTL
    })

    return result
  }

  async recursiveResolveDomain (domain: string, depth: number, options: ResolveDNSLinkOptions = {}): Promise<Array<ReturnType<Namespaces[keyof Namespaces]>>> {
    if (depth === 0) {
      throw new Error('recursion limit exceeded')
    }

    // the DNSLink spec says records MUST be stored on the `_dnslink.` subdomain
    // so start looking for records there, we will fall back to the bare domain
    // if none are found
    if (!domain.startsWith('_dnslink.')) {
      domain = `_dnslink.${domain}`
    }

    try {
      return await this.recursiveResolveDnslink(domain, depth, options)
    } catch (err: any) {
      // If the code is not ENOTFOUND or ERR_DNSLINK_NOT_FOUND or ENODATA then throw the error
      if (err.code !== 'ENOTFOUND' && err.code !== 'ENODATA' && err.name !== 'DNSLinkNotFoundError' && err.name !== 'NotFoundError') {
        throw err
      }

      if (domain.startsWith('_dnslink.')) {
        // The supplied domain contains a _dnslink component
        // Check the non-_dnslink domain
        domain = domain.replace('_dnslink.', '')
      } else {
        // Check the _dnslink subdomain
        domain = `_dnslink.${domain}`
      }

      // If this throws then we propagate the error
      return this.recursiveResolveDnslink(domain, depth, options)
    }
  }

  async recursiveResolveDnslink (domain: string, depth: number, options: ResolveDNSLinkOptions = {}): Promise<Array<ReturnType<Namespaces[keyof Namespaces]>>> {
    if (depth === 0) {
      throw new Error('recursion limit exceeded')
    }

    this.log('query %s for TXT and CNAME records', domain)
    const txtRecordsResponse = await this.dns.query(domain, {
      ...options,
      types: [
        RecordType.TXT
      ]
    })

    // sort the TXT records to ensure deterministic processing
    const txtRecords = (txtRecordsResponse?.Answer ?? [])
      .sort((a, b) => a.data.localeCompare(b.data))

    this.log('found %d TXT records for %s', txtRecords.length, domain)

    const output: Array<ReturnType<Namespaces[keyof Namespaces]>> = []

    for (const answer of txtRecords) {
      try {
        let result = answer.data

        // strip leading and trailing " characters
        if (result.startsWith('"') && result.endsWith('"')) {
          result = result.substring(1, result.length - 1)
        }

        if (!result.startsWith('dnslink=')) {
          // invalid record?
          continue
        }

        this.log('%s TXT %s', answer.name, result)

        result = result.replace('dnslink=', '')

        // result is now a `/ipfs/<cid>` or `/ipns/<cid>` string
        const [, protocol, domainOrCID] = result.split('/') // e.g. ["", "ipfs", "<cid>"]

        if (protocol === 'dnslink') {
          // if the result was another DNSLink domain, try to follow it
          return await this.recursiveResolveDomain(domainOrCID, depth - 1, options)
        }

        const parser = this.namespaces[protocol]

        if (parser == null) {
          this.log('unknown protocol "%s" in DNSLink record for domain: %s', protocol, domain)
          continue
        }

        const record = parser(result, answer)

        if (record.namespace === 'dnslink') {
          // if the result was another DNSLink domain, try to follow it
          return await this.recursiveResolveDomain(record.value, depth - 1, options)
        }

        output.push(parser(result, answer))
      } catch (err: any) {
        this.log.error('could not parse DNS link record for domain %s, %s - %e', domain, answer.data, err)
      }
    }

    if (output.length > 0) {
      return output
    }

    // no dnslink records found, try CNAMEs
    this.log('no DNSLink records found for %s, falling back to CNAME', domain)

    const cnameRecordsResponse = await this.dns.query(domain, {
      ...options,
      types: [
        RecordType.CNAME
      ]
    })

    // sort the CNAME records to ensure deterministic processing
    const cnameRecords = (cnameRecordsResponse?.Answer ?? [])
      .sort((a, b) => a.data.localeCompare(b.data))

    this.log('found %d CNAME records for %s', cnameRecords.length, domain)

    for (const cname of cnameRecords) {
      try {
        return await this.recursiveResolveDomain(cname.data, depth - 1, options)
      } catch (err: any) {
        this.log.error('domain %s cname %s had no DNSLink records - %e', domain, cname.data, err)
      }
    }

    throw new DNSLinkNotFoundError(`No DNSLink records found for domain: ${domain}`)
  }
}
