import { } from '@libp2p/interface'
import { peerIdFromCID, peerIdFromString } from '@libp2p/peer-id'
import { RecordType } from '@multiformats/dns'
import { CID } from 'multiformats/cid'
import { DNSLinkNotFoundError } from './errors.js'
import type { ResolveDNSLinkOptions } from './index.js'
import type { Logger, PeerId } from '@libp2p/interface'
import type { Answer, DNS } from '@multiformats/dns'

const MAX_RECURSIVE_DEPTH = 32

export interface DNSLinkResult {
  answer: Answer
  value: string
}

async function recursiveResolveDnslink (domain: string, depth: number, dns: DNS, log: Logger, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
  if (depth === 0) {
    throw new Error('recursion limit exceeded')
  }

  log('query %s for TXT and CNAME records', domain)
  const txtRecordsResponse = await dns.query(domain, {
    ...options,
    types: [
      RecordType.TXT
    ]
  })

  // sort the TXT records to ensure deterministic processing
  const txtRecords = (txtRecordsResponse?.Answer ?? [])
    .sort((a, b) => a.data.localeCompare(b.data))

  log('found %d TXT records for %s', txtRecords.length, domain)

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

      log('%s TXT %s', answer.name, result)

      result = result.replace('dnslink=', '')

      // result is now a `/ipfs/<cid>` or `/ipns/<cid>` string
      const [, protocol, domainOrCID, ...rest] = result.split('/') // e.g. ["", "ipfs", "<cid>"]

      if (protocol === 'ipfs') {
        try {
          const cid = CID.parse(domainOrCID)

          // if the result is a CID, we've reached the end of the recursion
          return {
            value: `/ipfs/${cid}${rest.length > 0 ? `/${rest.join('/')}` : ''}`,
            answer
          }
        } catch {}
      } else if (protocol === 'ipns') {
        try {
          let peerId: PeerId

          // eslint-disable-next-line max-depth
          if (domainOrCID.charAt(0) === '1' || domainOrCID.charAt(0) === 'Q') {
            peerId = peerIdFromString(domainOrCID)
          } else {
            // try parsing as a CID
            peerId = peerIdFromCID(CID.parse(domainOrCID))
          }

          // if the result is a PeerId, we've reached the end of the recursion
          return {
            value: `/ipns/${peerId}${rest.length > 0 ? `/${rest.join('/')}` : ''}`,
            answer
          }
        } catch {}

        // if the result was another IPNS domain, try to follow it
        return await recursiveResolveDomain(domainOrCID, depth - 1, dns, log, options)
      } else if (protocol === 'dnslink') {
        // if the result was another DNSLink domain, try to follow it
        return await recursiveResolveDomain(domainOrCID, depth - 1, dns, log, options)
      } else {
        log('unknown protocol "%s" in DNSLink record for domain: %s', protocol, domain)
        continue
      }
    } catch (err: any) {
      log.error('could not parse DNS link record for domain %s, %s', domain, answer.data, err)
    }
  }

  // no dnslink records found, try CNAMEs
  log('no DNSLink records found for %s, falling back to CNAME', domain)

  const cnameRecordsResponse = await dns.query(domain, {
    ...options,
    types: [
      RecordType.CNAME
    ]
  })

  // sort the CNAME records to ensure deterministic processing
  const cnameRecords = (cnameRecordsResponse?.Answer ?? [])
    .sort((a, b) => a.data.localeCompare(b.data))

  log('found %d CNAME records for %s', cnameRecords.length, domain)

  for (const cname of cnameRecords) {
    try {
      return await recursiveResolveDomain(cname.data, depth - 1, dns, log, options)
    } catch (err: any) {
      log.error('domain %s cname %s had no DNSLink records', domain, cname.data, err)
    }
  }

  throw new DNSLinkNotFoundError(`No DNSLink records found for domain: ${domain}`)
}

async function recursiveResolveDomain (domain: string, depth: number, dns: DNS, log: Logger, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
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
    return await recursiveResolveDnslink(domain, depth, dns, log, options)
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
    return recursiveResolveDnslink(domain, depth, dns, log, options)
  }
}

export async function resolveDNSLink (domain: string, dns: DNS, log: Logger, options: ResolveDNSLinkOptions = {}): Promise<DNSLinkResult> {
  return recursiveResolveDomain(domain, options.maxRecursiveDepth ?? MAX_RECURSIVE_DEPTH, dns, log, options)
}
