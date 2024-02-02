import { CID } from 'multiformats/cid'
import { parseUrlString } from './parse-url-string.js'
import type { ParsedUrlStringResults } from './parse-url-string.js'
import type { Resource } from '../index.js'
import type { IPNS, IPNSRoutingEvents, ResolveDnsLinkProgressEvents, ResolveProgressEvents } from '@helia/ipns'
import type { ComponentLogger } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

export interface ParseResourceComponents {
  ipns: IPNS
  logger: ComponentLogger
}

export interface ParseResourceOptions extends ProgressOptions<ResolveProgressEvents | IPNSRoutingEvents | ResolveDnsLinkProgressEvents> {

}
/**
 * Handles the different use cases for the `resource` argument.
 * The resource can represent an IPFS path, IPNS path, or CID.
 * If the resource represents an IPNS path, we need to resolve it to a CID.
 */
export async function parseResource (resource: Resource, { ipns, logger }: ParseResourceComponents, options?: ParseResourceOptions): Promise<ParsedUrlStringResults> {
  if (typeof resource === 'string') {
    return parseUrlString({ urlString: resource, ipns, logger }, { onProgress: options?.onProgress })
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
