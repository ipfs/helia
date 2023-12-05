import { CodeError } from '@libp2p/interface/errors'
import * as isIPFS from 'is-ipfs'
import type { DNSResolver, ResolveDnsLinkOptions } from '../index.js'

export interface Question {
  name: string
  type: number
}

export interface Answer {
  name: string
  type: number
  TTL: number
  data: string
}

export interface DNSResponse {
  Status: number
  TC: boolean
  RD: boolean
  RA: boolean
  AD: boolean
  CD: boolean
  Question: Question[]
  Answer?: Answer[]
}

export const ipfsPathForAnswer = (answer: Answer): string => {
  let data = answer.data

  if (data.startsWith('"')) {
    data = data.substring(1)
  }

  if (data.endsWith('"')) {
    data = data.substring(0, data.length - 1)
  }

  return data.replace('dnslink=', '')
}

export const ipfsPathAndAnswer = (domain: string, response: DNSResponse): { ipfsPath: string, answer: Answer } => {
  const answer = findDNSLinkAnswer(domain, response)

  return {
    ipfsPath: ipfsPathForAnswer(answer),
    answer
  }
}

export const findDNSLinkAnswer = (domain: string, response: DNSResponse): Answer => {
  const answer = response.Answer?.filter(a => a.data.includes('dnslink=/ipfs') || a.data.includes('dnslink=/ipns')).pop()

  if (answer == null) {
    throw new CodeError(`No dnslink records found for domain: ${domain}`, 'ERR_DNSLINK_NOT_FOUND')
  }

  return answer
}

export const MAX_RECURSIVE_DEPTH = 32

export const recursiveResolveDnslink = async (domain: string, depth: number, resolve: DNSResolver, options: ResolveDnsLinkOptions = {}): Promise<string> => {
  if (depth === 0) {
    throw new Error('recursion limit exceeded')
  }

  let dnslinkRecord: string

  try {
    dnslinkRecord = await resolve(domain, options)
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
    dnslinkRecord = await resolve(domain, options)
  }

  const result = dnslinkRecord.replace('dnslink=', '')
  // result is now a `/ipfs/<cid>` or `/ipns/<cid>` string
  const domainOrCID = result.split('/')[2] // e.g. ["", "ipfs", "<cid>"]
  const isIPFSCID = isIPFS.cid(domainOrCID)

  // if the result is a CID, or depth is 1, we've reached the end of the recursion
  // if depth is 1, another recursive call will be made, but it would throw.
  // we could return if depth is 1 and allow users to handle, but that may be a breaking change
  if (isIPFSCID) {
    return result
  }

  return recursiveResolveDnslink(domainOrCID, depth - 1, resolve, options)
}

interface DnsResolver {
  resolveTxt(domain: string): Promise<string[][]>
}

const DNSLINK_REGEX = /^dnslink=.+$/
export const resolveFn = async (resolver: DnsResolver, domain: string): Promise<string> => {
  const records = await resolver.resolveTxt(domain)
  const dnslinkRecords = records.flat()
    .filter(record => DNSLINK_REGEX.test(record))

  // we now have dns text entries as an array of strings
  // only records passing the DNSLINK_REGEX text are included
  // TODO: support multiple dnslink records
  const dnslinkRecord = dnslinkRecords[0]

  if (dnslinkRecord == null) {
    throw new CodeError(`No dnslink records found for domain: ${domain}`, 'ERR_DNSLINK_NOT_FOUND')
  }

  return dnslinkRecord
}
