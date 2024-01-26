/**
 * @packageDocumentation
 *
 * Exports a `createVerifiedFetch` function that returns a `fetch()` like API method {@link Helia} for fetching IPFS content.
 *
 * You may use any supported resource argument to fetch content:
 *
 * - CID instance
 * - IPFS URL
 * - IPNS URL
 *
 * @example Using a CID instance to fetch JSON
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 * import { CID } from 'multiformats/cid'
 *
 * const verifiedFetch = await createVerifiedFetch({
 *  gateways: ['http://mygateway.info', 'http://trustless-gateway.link']
 * })
 *
 * const cid = CID.parse('bafyFoo') // some image file
 * const response = await verifiedFetch(cid)
 * const json = await response.json()
 * ```
 *
 * @example Using ipfs protocol to fetch an image
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const verifiedFetch = await createVerifiedFetch({
 *  gateways: ['http://mygateway.info', 'http://trustless-gateway.link']
 * })
 * const response = await verifiedFetch('ipfs://bafyFoo') // CID for some image file
 * const blob = await response.blob()
 * ```
 *
 * @example Using ipns protocol to fetch a video
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const verifiedFetch = await createVerifiedFetch({
 *  gateways: ['http://mygateway.info', 'http://trustless-gateway.link']
 * })
 * const response = await verifiedFetch('ipns://mydomain.com/path/to/video.mp4')
 * const videoStreamReader = await response.body.getReader()
 */

import { trustlessGateway } from '@helia/block-brokers'
import { createHeliaHTTP } from '@helia/http'
import { delegatedHTTPRouting } from '@helia/routers'
import { VerifiedFetch } from './verified-fetch.js'
import type { Helia, Routing } from '@helia/interface'
import type { ResolveDnsLinkProgressEvents, ResolveProgressEvents } from '@helia/ipns'
import type { GetEvents } from '@helia/unixfs'
import type { AbortOptions } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

/**
 * The types for the first argument of the `verifiedFetch` function.
 */
export type ResourceType = string | CID

export interface CIDDetail {
  cid: string
  path: string
}

export interface CIDDetailError extends CIDDetail {
  error: Error
}

export type VerifiedFetchMethod = InstanceType<typeof VerifiedFetch>['fetch'] & {
  start: InstanceType<typeof VerifiedFetch>['start']
  stop: InstanceType<typeof VerifiedFetch>['stop']
}

/**
 * Instead of passing a Helia instance, you can pass a list of gateways and routers, and a HeliaHTTP instance will be created for you.
 */
export interface CreateVerifiedFetchWithOptions {
  gateways: string[]
  routers?: string[]
}

export type BubbledProgressEvents =
  // unixfs
  GetEvents |
  // ipns
  ResolveProgressEvents | ResolveDnsLinkProgressEvents

export type VerifiedFetchProgressEvents =
  ProgressEvent<'verified-fetch:request:start', CIDDetail> |
  ProgressEvent<'verified-fetch:request:info', string> |
  ProgressEvent<'verified-fetch:request:progress:chunk', CIDDetail> |
  ProgressEvent<'verified-fetch:request:end', CIDDetail> |
  ProgressEvent<'verified-fetch:request:error', CIDDetailError>

/**
 * Options for the `fetch` function returned by `createVerifiedFetch`.
 *
 * This method accepts all the same options as the `fetch` function in the browser, plus an `onProgress` option to
 * listen for progress events. The only diferrence is that the `signal` property is a subset of the fetch options
 * `signal` property. The signal property received here cannot be `null`, only `AbortSignal | undefined`.
 */
export interface VerifiedFetchOptions extends Omit<RequestInit, 'signal'>, AbortOptions, ProgressOptions<BubbledProgressEvents | VerifiedFetchProgressEvents> {
}

/**
 * Create and return a Helia node
 */
export async function createVerifiedFetch (init: Helia | CreateVerifiedFetchWithOptions): Promise<VerifiedFetchMethod> {
  let heliaInstance: null | Helia = null
  if (isHelia(init)) {
    heliaInstance = init
  } else {
    const config = init
    let routers: undefined | Array<Partial<Routing>>
    if (config.routers != null) {
      routers = config.routers.map((routerUrl) => delegatedHTTPRouting(routerUrl))
    }
    heliaInstance = await createHeliaHTTP({
      blockBrokers: [
        trustlessGateway({
          gateways: config.gateways
        })
      ],
      routers
    })
  }

  const verifiedFetchInstance = new VerifiedFetch({ helia: heliaInstance })
  async function verifiedFetch (resource: ResourceType, options: VerifiedFetchOptions): Promise<Response> {
    return verifiedFetchInstance.fetch(resource, options)
  }
  verifiedFetch.stop = verifiedFetchInstance.stop.bind(verifiedFetchInstance)
  verifiedFetch.start = verifiedFetchInstance.start.bind(verifiedFetchInstance)

  return verifiedFetch
}

function isHelia (obj: any): obj is Helia {
  // test for the presence of known Helia properties, return a boolean value
  return obj?.blockstore != null &&
    obj?.datastore != null &&
    obj?.gc != null &&
    obj?.stop != null &&
    obj?.start != null
}
