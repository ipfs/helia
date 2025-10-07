import { peerIdFromString } from '@libp2p/peer-id'
import { InvalidNamespaceError } from '../errors.ts'
import type { DNSLinkResult, DNSLinkNamespace } from '../index.js'
import type { Answer } from '@multiformats/dns'

export const ipns: DNSLinkNamespace = {
  parse: (value: string, answer: Answer): DNSLinkResult => {
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
}
