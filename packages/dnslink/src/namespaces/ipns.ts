import { peerIdFromString } from '@libp2p/peer-id'
import { InvalidNamespaceError } from '../errors.ts'
import type { DNSLinkParser, DNSLinkIPNSResult, DNSLinkDNSLinkResult } from '../index.js'
import type { Answer } from '@multiformats/dns'

export const ipns: DNSLinkParser<DNSLinkIPNSResult | DNSLinkDNSLinkResult> = (value: string, answer: Answer): DNSLinkIPNSResult | DNSLinkDNSLinkResult => {
  const [, protocol, peerId, ...rest] = value.split('/')

  if (protocol !== 'ipns') {
    throw new InvalidNamespaceError(`Namespace ${protocol} was not "ipns"`)
  }

  try {
    // if the result parses as a PeerId, we've reached the end of the recursion
    return {
      namespace: 'ipns',
      peerId: peerIdFromString(peerId),
      path: rest.length > 0 ? `/${rest.join('/')}` : '',
      answer
    }
  } catch {
    // if the value did not parse as a PeerId, it's probably another DNSLink
    return {
      namespace: 'dnslink',
      value: peerId,
      path: rest.length > 0 ? `/${rest.join('/')}` : '',
      answer
    }
  }
}
