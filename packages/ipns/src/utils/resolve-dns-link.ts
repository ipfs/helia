import dns from 'dns'
import { promisify } from 'util'
import * as isIPFS from 'is-ipfs'
import type { AbortOptions } from '@libp2p/interface'

const MAX_RECURSIVE_DEPTH = 32

export async function resolveDnslink (domain: string, options: AbortOptions = {}): Promise<string> {
  return recursiveResolveDnslink(domain, MAX_RECURSIVE_DEPTH, options)
}

async function recursiveResolveDnslink (domain: string, depth: number, options: AbortOptions = {}): Promise<string> {
  if (depth === 0) {
    throw new Error('recursion limit exceeded')
  }

  let dnslinkRecord

  try {
    dnslinkRecord = await resolve(domain)
  } catch (err: any) {
    // If the code is not ENOTFOUND or ERR_DNSLINK_NOT_FOUND or ENODATA then throw the error
    if (err.code !== 'ENOTFOUND' && err.code !== 'ERR_DNSLINK_NOT_FOUND' && err.code !== 'ENODATA') {
      throw err
    }

    if (domain.startsWith('_dnslink.')) {
      // The supplied domain contains a _dnslink component
      // Check the non-_dnslink domain
      dnslinkRecord = await resolve(domain.replace('_dnslink.', ''))
    } else {
      // Check the _dnslink subdomain
      const _dnslinkDomain = `_dnslink.${domain}`
      // If this throws then we propagate the error
      dnslinkRecord = await resolve(_dnslinkDomain)
    }
  }

  const result = dnslinkRecord.replace('dnslink=', '')
  const domainOrCID = result.split('/')[2]
  const isIPFSCID = isIPFS.cid(domainOrCID)

  if (isIPFSCID || depth === 0) {
    return result
  }

  return recursiveResolveDnslink(domainOrCID, depth - 1, options)
}

async function resolve (domain: string, options: AbortOptions = {}): Promise<string> {
  const DNSLINK_REGEX = /^dnslink=.+$/
  const records = await promisify(dns.resolveTxt)(domain)
  const dnslinkRecords = records.reduce((rs, r) => rs.concat(r), [])
    .filter(record => DNSLINK_REGEX.test(record))

  const dnslinkRecord = dnslinkRecords[0]

  // we now have dns text entries as an array of strings
  // only records passing the DNSLINK_REGEX text are included
  if (dnslinkRecord == null) {
    throw new Error(`No dnslink records found for domain: ${domain}`)
  }

  return dnslinkRecord
}
