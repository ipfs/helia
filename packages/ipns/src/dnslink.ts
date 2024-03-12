import { CodeError, type Logger } from '@libp2p/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import { RecordType } from '@multiformats/dns'
import { CID } from 'multiformats/cid'
import type { ResolveDNSOptions } from './index.js'
import type { DNS } from '@multiformats/dns'

const MAX_RECURSIVE_DEPTH = 32

export const recursiveResolveDnslink = async (domain: string, depth: number, dns: DNS, log: Logger, options: ResolveDNSOptions = {}): Promise<string> => {
  if (depth === 0) {
    throw new Error('recursion limit exceeded')
  }

  const response = await dns.query(domain, {
    ...options,
    types: [
      RecordType.TXT
    ]
  })

  // TODO: support multiple dnslink records
  for (const answer of response.Answer) {
    try {
      let result = answer.data

      if (!result.startsWith('dnslink=')) {
        // invalid record?
        continue
      }

      result = result.replace('dnslink=', '')
      // result is now a `/ipfs/<cid>` or `/ipns/<cid>` string
      const [, protocol, domainOrCID, ...rest] = result.split('/') // e.g. ["", "ipfs", "<cid>"]

      if (protocol === 'ipfs') {
        try {
          const cid = CID.parse(domainOrCID)

          // if the result is a CID, we've reached the end of the recursion
          return `/ipfs/${cid}${rest.length > 0 ? `/${rest.join('/')}` : ''}`
        } catch {}
      } else if (protocol === 'ipns') {
        try {
          const peerId = peerIdFromString(domainOrCID)

          // if the result is a PeerId, we've reached the end of the recursion
          return `/ipns/${peerId}${rest.length > 0 ? `/${rest.join('/')}` : ''}`
        } catch {}

        // if the result was another IPNS domain, try to follow it
        return await recursiveResolveDnslink(domainOrCID, depth - 1, dns, log, options)
      } else {
        throw new CodeError(`Unknown protocol in DNSLink record for domain: ${domain}`, 'ERR_DNSLINK_NOT_FOUND')
      }
    } catch (err: any) {
      log.error('could not parse DNS link record for domain %s, %s', domain, answer.data, err)
    }
  }

  throw new CodeError(`No DNSLink records found for domain: ${domain}`, 'ERR_DNSLINK_NOT_FOUND')
}

export async function resolveDNSLink (domain: string, dns: DNS, log: Logger, options: ResolveDNSOptions = {}): Promise<string> {
  try {
    return await recursiveResolveDnslink(domain, options.maxRecursiveDepth ?? MAX_RECURSIVE_DEPTH, dns, log, options)
  } catch (err: any) {
    // If the code is not ENOTFOUND or ERR_DNSLINK_NOT_FOUND or ENODATA then throw the error
    if (err.code !== 'ENOTFOUND' && err.code !== 'ERR_DNSLINK_NOT_FOUND' && err.code !== 'ENODATA') {
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
    return await recursiveResolveDnslink(domain, options.maxRecursiveDepth ?? MAX_RECURSIVE_DEPTH, dns, log, options)
  }
}
