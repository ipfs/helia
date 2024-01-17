/**
 * @packageDocumentation
 *
 * Exports a `createVerifiedFetch` function that returns a `fetch()` like API method {@link Helia} for fetching IPFS content.
 *
 * You may use any supported resource argument to fetch content:
 *
 * - CID string
 * - CID instance
 * - IPFS URL
 * - IPNS URL
 *
 * @example Use a CID string to fetch a text file
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const verifiedFetch = await createVerifiedFetch({
 *  gateways: ['mygateway.info', 'trustless-gateway.link']
 * })
 *
 * const response = await verifiedFetch('bafyFoo') // CID for some text file
 * // OR const response = await verifiedFetch('ipfs://bafy...')
 * // OR const response = await verifiedFetch('ipns://mydomain.com/path/to/file')
 * // OR const response = await verifiedFetch('https://mygateway.info/ipfs/bafyFoo')
 * const text = await response.text()
 * ```
 *
 * @example Using a CID instance to fetch JSON
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 * import { CID } from 'multiformats/cid'
 *
 * const verifiedFetch = await createVerifiedFetch({
 *  gateways: ['mygateway.info', 'trustless-gateway.link']
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
 *  gateways: ['mygateway.info', 'trustless-gateway.link']
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
 *  gateways: ['mygateway.info', 'trustless-gateway.link']
 * })
 * const response = await verifiedFetch('ipns://mydomain.com/path/to/video.mp4')
 * const videoStreamReader = await response.body.getReader()
 */

import type { Helia, Routing } from '@helia/interface'
import { createHeliaHTTP } from '@helia/http'
import { trustlessGateway } from '@helia/block-brokers'
import { VerifiedFetch } from './verified-fetch.js'
import type { CreateVerifiedFetchWithOptions } from './interface.js'
import { delegatedHTTPRouting } from '@helia/routers'

/**
 * Create and return a Helia node
 */
export async function createVerifiedFetch (init: Helia | CreateVerifiedFetchWithOptions): Promise<InstanceType<typeof VerifiedFetch>['fetch']> {
  let heliaInstance: null | Helia = null
  if ((init as CreateVerifiedFetchWithOptions).gateways == null) {
    heliaInstance = init as Helia
  } else {
    const config = init as CreateVerifiedFetchWithOptions
    let routers: undefined | Array<Partial<Routing>> = undefined
    if (config.routers != null) {
      routers = config.routers.map((routerUrl) => delegatedHTTPRouting(routerUrl))
    }
    heliaInstance = await createHeliaHTTP({
      blockBrokers: [
        trustlessGateway({
          gateways: config.gateways,
        }),
      ],
      routers,
    })
  }

  const verifiedFetchInstance = new VerifiedFetch(heliaInstance)

  return verifiedFetchInstance.fetch.bind(verifiedFetchInstance)
}
