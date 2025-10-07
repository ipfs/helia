import { CID } from 'multiformats/cid'
import { InvalidNamespaceError } from '../errors.ts'
import type { DNSLinkResult, DNSLinkNamespace } from '../index.js'
import type { Answer } from '@multiformats/dns'

export const ipfs: DNSLinkNamespace = {
  parse: (value: string, answer: Answer): DNSLinkResult => {
    const [, protocol, cid, ...rest] = value.split('/')

    if (protocol !== 'ipfs') {
      throw new InvalidNamespaceError(`Namespace ${protocol} was not "ipfs"`)
    }

    // if the result is a CID, we've reached the end of the recursion
    return {
      namespace: 'ipfs',
      cid: CID.parse(cid),
      path: rest.length > 0 ? `/${rest.join('/')}` : '',
      answer
    }
  }
}
