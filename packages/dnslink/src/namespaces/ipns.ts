import { peerIdFromString } from '@libp2p/peer-id'
import { InvalidNamespaceError } from '../errors.ts'
import type { DNSLinkParser, DNSLinkIPNSResult } from '../index.js'
import type { Answer } from '@multiformats/dns'

export const ipns: DNSLinkParser<DNSLinkIPNSResult> = (value: string, answer: Answer): DNSLinkIPNSResult => {
  const [, protocol, peerId, ...rest] = value.split('/')

  if (protocol !== 'ipns') {
    throw new InvalidNamespaceError(`Namespace ${protocol} was not "ipns"`)
  }

  // if the result is a CID, we've reached the end of the recursion
  return {
    namespace: 'ipns',
    peerId: peerIdFromString(peerId),
    path: rest.length > 0 ? `/${rest.join('/')}` : '',
    answer
  }
}
