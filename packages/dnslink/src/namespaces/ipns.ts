import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { InvalidNamespaceError } from '../errors.ts'
import type { DNSLinkParser, DNSLinkIPNSResult, DNSLinkDNSLinkResult } from '../index.ts'
import type { Answer } from '@multiformats/dns'
import type { MultihashDigest } from 'multiformats/cid'

export const ipns: DNSLinkParser<DNSLinkIPNSResult | DNSLinkDNSLinkResult> = (value: string, answer: Answer): DNSLinkIPNSResult | DNSLinkDNSLinkResult => {
  const [, protocol, peerId, ...rest] = value.split('/')

  if (protocol !== 'ipns') {
    throw new InvalidNamespaceError(`Namespace ${protocol} was not "ipns"`)
  }

  try {
    // if the result parses as a base58btc encoded multihash or a CID, we've
    // reached the end of the recursion
    return {
      namespace: 'ipns',
      value: decode(peerId),
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

/**
 * Attempt to decode the passed string as a base58btc encoded multihash or a CID
 */
function decode (str: string): MultihashDigest {
  try {
    return Digest.decode(base58btc.baseDecode(str))
  } catch {
    return CID.parse(str).multihash
  }
}
