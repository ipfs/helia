import { MAX_RECURSIVE_DEPTH, RecordType } from '@multiformats/dns'
import { DNSLinkNotFoundError } from './errors.js'
import { ipfs } from './namespaces/ipfs.ts'
import { ipns } from './namespaces/ipns.ts'
import type { DNSLink as DNSLinkInterface, ResolveDNSLinkOptions, DNSLinkOptions, DNSLinkComponents, DNSLinkResult, DNSLinkNamespace } from './index.js'
import type { Logger } from '@libp2p/interface'
import type { DNS } from '@multiformats/dns'

export class DNSLink implements DNSLinkInterface {
  private readonly dns: DNS
  private readonly log: Logger
  private readonly namespaces: Record<string, DNSLinkNamespace>

  constructor (components: DNSLinkComponents, init: DNSLinkOptions = {}) {
    this.dns = components.dns
    this.log = components.logger.forComponent('helia:dnslink')
    this.namespaces = {
      ipfs,
      ipns,
      ...init.namespaces
    }
  }

  async resolve (domain: string, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
    return this.recursiveResolveDomain(domain, options.maxRecursiveDepth ?? MAX_RECURSIVE_DEPTH, options)
  }

  async recursiveResolveDomain (domain: string, depth: number, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
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

  async recursiveResolveDnslink (domain: string, depth: number, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
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

        return parser.parse(result, answer)
      } catch (err: any) {
        this.log.error('could not parse DNS link record for domain %s, %s', domain, answer.data, err)
      }
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
