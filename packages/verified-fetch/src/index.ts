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
import type { CreateVerifiedFetchWithOptions } from './interface.js'
import type { Helia, Routing } from '@helia/interface'

export type VerifiedFetchMethod = InstanceType<typeof VerifiedFetch>['fetch'] & {
  start: InstanceType<typeof VerifiedFetch>['start']
  stop: InstanceType<typeof VerifiedFetch>['stop']
}

/**
 * Create and return a Helia node
 */
export async function createVerifiedFetch (init: Helia | CreateVerifiedFetchWithOptions): Promise<VerifiedFetchMethod> {
  let heliaInstance: null | Helia = null
  if ((init as CreateVerifiedFetchWithOptions).gateways == null) {
    heliaInstance = init as Helia
  } else {
    const config = init as CreateVerifiedFetchWithOptions
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
  async function verifiedFetch (...args: Parameters<typeof verifiedFetchInstance.fetch>): ReturnType<typeof verifiedFetchInstance.fetch> {
    return verifiedFetchInstance.fetch(...args)
  }
  verifiedFetch.stop = verifiedFetchInstance.stop.bind(verifiedFetchInstance)
  verifiedFetch.start = verifiedFetchInstance.start.bind(verifiedFetchInstance)

  return verifiedFetch
}