import { CID } from 'multiformats/cid'
import { parseUrlString } from './parse-url-string.js'
import type { ParsedUrlStringResults } from './parse-url-string.js'
import type { ResourceType } from '../index.js'
import type { IPNS } from '@helia/ipns'
/**
 * Handles the different use cases for the `resource` argument.
 * The resource can represent an IPFS path, IPNS path, or CID.
 * If the resource represents an IPNS path, we need to resolve it to a CID.
 */
export async function parseResource (resource: ResourceType, ipns: IPNS): Promise<ParsedUrlStringResults> {
  if (typeof resource === 'string') {
    return parseUrlString({ urlString: resource, ipns })
  }
  const cid = CID.asCID(resource)
  if (cid != null) {
    // an actual CID
    return {
      cid,
      protocol: 'ipfs',
      path: '',
      query: {}
    }
  }
  throw new TypeError(`Invalid resource. Cannot determine CID from resource: ${resource}`)
}
