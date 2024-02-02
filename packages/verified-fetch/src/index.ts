/**
 * @packageDocumentation
 *
 * `@helia/verified-fetch` is a library that provides a fetch-like API for fetching trustless content from IPFS and verifying it.
 *
 * This library should act as a replacement for the `fetch()` API for fetching content from IPFS, and will return a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object that can be used in a similar manner to the `fetch()` API. This means browser and HTTP caching inside browser main threads, web-workers, and service workers, as well as other features of the `fetch()` API should work in a way familiar to developers.
 *
 * Exports a `createVerifiedFetch` function that returns a `fetch()` like API method {@link Helia} for fetching IPFS content.
 *
 * You may use any supported resource argument to fetch content:
 *
 * - CID instance
 * - IPFS URL
 * - IPNS URL
 *
 * @example
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const fetch = await createVerifiedFetch({
 *  gateways: ['https://mygateway.example.net', 'https://trustless-gateway.link']
 *})
 *
 * const resp = await fetch('ipfs://bafy...')
 *
 * const json = await resp.json()
 *```
 *
 *
 * @example Using a CID instance to fetch JSON
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 * import { CID } from 'multiformats/cid'
 *
 * const fetch = await createVerifiedFetch({
 *  gateways: ['https://mygateway.example.net', 'https://trustless-gateway.link']
 * })
 *
 * const cid = CID.parse('bafyFoo') // some image file
 * const response = await fetch(cid)
 * const json = await response.json()
 * ```
 *
 * @example Using IPFS protocol to fetch an image
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const fetch = await createVerifiedFetch({
 *  gateways: ['https://mygateway.example.net', 'https://trustless-gateway.link']
 * })
 * const response = await fetch('ipfs://bafyFoo') // CID for some image file
 * const blob = await response.blob()
 * const image = document.createElement('img')
 * image.src = URL.createObjectURL(blob)
 * document.body.appendChild(image)
 * ```
 *
 * @example Using IPNS protocol to stream a big file
 *
 * ```typescript
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const fetch = await createVerifiedFetch({
 *  gateways: ['https://mygateway.example.net', 'https://trustless-gateway.link']
 * })
 * const response = await fetch('ipns://mydomain.com/path/to/very-long-file.log')
 * const bigFileStreamReader = await response.body.getReader()
 * ```
 *
 * ### Configuration
 *
 * #### Usage with customized Helia
 *
 * You can see variations of Helia and js-libp2p configuration options at https://helia.io/interfaces/helia.index.HeliaInit.html.
 *
 * The `@helia/http` module is currently in-progress, but the init options should be a subset of the `helia` module's init options. See https://github.com/ipfs/helia/issues/289 for more information.
 *
 * ```typescript
 * import { trustlessGateway } from '@helia/block-brokers'
 * import { createHeliaHTTP } from '@helia/http'
 * import { delegatedHTTPRouting } from '@helia/routers'
 * import { createVerifiedFetch } from '@helia/verified-fetch'
 *
 * const fetch = await createVerifiedFetch(
 *   await createHeliaHTTP({
 *       blockBrokers: [
 *         trustlessGateway({
 *           gateways: ['https://mygateway.example.net', 'https://trustless-gateway.link']
 *         })
 *       ],
 *       routers: ['http://delegated-ipfs.dev'].map((routerUrl) => delegatedHTTPRouting(routerUrl))
 *     })
 * )
 *
 * const resp = await fetch('ipfs://bafy...')
 *
 * const json = await resp.json()
 * ```
 *
 * ### Comparison to fetch
 *
 * First, this library will require instantiation in order to configure the gateways and delegated routers, or potentially a custom Helia instance. Secondly, once your verified-fetch method is created, it will act as similar to the `fetch()` API as possible.
 *
 * [The `fetch()` API](https://developer.mozilla.org/en-US/docs/Web/API/fetch) takes two parameters:
 *
 * 1. A [resource](https://developer.mozilla.org/en-US/docs/Web/API/fetch#resource)
 * 2. An [options object](https://developer.mozilla.org/en-US/docs/Web/API/fetch#options)
 *
 * #### Resource argument
 *
 * This library intends to support the following methods of fetching web3 content from IPFS:
 *
 * 1. IPFS protocol: `ipfs://<cidv0>` & `ipfs://<cidv0>`
 * 2. IPNS protocol: `ipns://<peerId>` & `ipns://<publicKey>` & `ipns://<hostUri_Supporting_DnsLink_TxtRecords>`
 * 3. CID instances: An actual CID instance `CID.parse('bafy...')`
 *
 * As well as support for pathing & params for item 1&2 above according to [IPFS - Path Gateway Specification](https://specs.ipfs.tech/http-gateways/path-gateway) & [IPFS - Trustless Gateway Specification](https://specs.ipfs.tech/http-gateways/trustless-gateway/). Further refinement of those specifications specifically for web-based scenarios can be found in the [Web Pathing Specification IPIP](https://github.com/ipfs/specs/pull/453).
 *
 * If you pass a CID instance, we assume you want the content for that specific CID only, and do not support pathing or params for that CID.
 *
 * #### Options argument
 *
 * This library does not plan to support the exact Fetch API options object, as some of the arguments don't make sense. Instead, it will only support options necessary to meet [IPFS specs](https://specs.ipfs.tech/) related to specifying the resultant shape of desired content.
 *
 * Some of those header specifications are:
 *
 * 1. https://specs.ipfs.tech/http-gateways/path-gateway/#request-headers
 * 2. https://specs.ipfs.tech/http-gateways/trustless-gateway/#request-headers
 * 3. https://specs.ipfs.tech/http-gateways/subdomain-gateway/#request-headers
 *
 * Where possible, options and Helia internals will be automatically configured to the appropriate codec & content type based on the `verified-fetch` configuration and `options` argument passed.
 *
 * Known Fetch API options that will be supported:
 *
 * 1. `signal` - An AbortSignal that a user can use to abort the request.
 * 2. `redirect` - A string that specifies the redirect type. One of `follow`, `error`, or `manual`. Defaults to `follow`. Best effort to adhere to the [Fetch API redirect](https://developer.mozilla.org/en-US/docs/Web/API/fetch#redirect) parameter.
 * 3. `headers` - An object of headers to be sent with the request. Best effort to adhere to the [Fetch API headers](https://developer.mozilla.org/en-US/docs/Web/API/fetch#headers) parameter.
 *     - `accept` - A string that specifies the accept header. Relevant values:
 *         - [`vnd.ipld.raw`](https://www.iana.org/assignments/media-types/application/vnd.ipld.raw). (default)
 *         - [`vnd.ipld.car`](https://www.iana.org/assignments/media-types/application/vnd.ipld.car)
 *         - [`vnd.ipfs.ipns-record`](https://www.iana.org/assignments/media-types/application/vnd.ipfs.ipns-record)
 * 4. `method` - A string that specifies the HTTP method to use for the request. Defaults to `GET`. Best effort to adhere to the [Fetch API method](https://developer.mozilla.org/en-US/docs/Web/API/fetch#method) parameter.
 * 5. `body` - An object that specifies the body of the request. Best effort to adhere to the [Fetch API body](https://developer.mozilla.org/en-US/docs/Web/API/fetch#body) parameter.
 * 6. `cache` - Will basically act as `force-cache` for the request. Best effort to adhere to the [Fetch API cache](https://developer.mozilla.org/en-US/docs/Web/API/fetch#cache) parameter.
 *
 *
 * Non-Fetch API options that will be supported:
 *
 * 1. `onProgress` - Similar to Helia `onProgress` options, this will be a function that will be called with a progress event. Supported progress events are:
 *     - `helia:verified-fetch:error` - An error occurred during the request.
 *     - `helia:verified-fetch:request:start` - The request has been sent
 *     - `helia:verified-fetch:request:complete` - The request has been sent
 *     - `helia:verified-fetch:request:error` - An error occurred during the request.
 *     - `helia:verified-fetch:request:abort` - The request was aborted prior to completion.
 *     - `helia:verified-fetch:response:start` - The initial HTTP Response headers have been set, and response stream is started.
 *     - `helia:verified-fetch:response:complete` - The response stream has completed.
 *     - `helia:verified-fetch:response:error` - An error occurred while building the response.
 *
 * Some in-flight specs (IPIPs) that will affect the options object this library supports in the future can be seen at https://specs.ipfs.tech/ipips, a subset are:
 *
 * 1. [IPIP-0412: Signaling Block Order in CARs on HTTP Gateways](https://specs.ipfs.tech/ipips/ipip-0412/)
 * 2. [IPIP-0402: Partial CAR Support on Trustless Gateways](https://specs.ipfs.tech/ipips/ipip-0402/)
 * 3. [IPIP-0386: Subdomain Gateway Interop with _redirects](https://specs.ipfs.tech/ipips/ipip-0386/)
 * 4. [IPIP-0328: JSON and CBOR Response Formats on HTTP Gateways](https://specs.ipfs.tech/ipips/ipip-0328/)
 * 5. [IPIP-0288: TAR Response Format on HTTP Gateways](https://specs.ipfs.tech/ipips/ipip-0288/)
 *
 * #### Response types
 *
 * This library's purpose is to return reasonably representable content from IPFS. In other words, fetching content is intended for leaf-node content -- such as images/videos/audio & other assets, or other IPLD content (with link) -- that can be represented by https://developer.mozilla.org/en-US/docs/Web/API/Response#instance_methods. The content type you receive back will depend upon the CID you request as well as the `Accept` header value you provide.
 *
 * All content we retrieve from the IPFS network is obtained via an AsyncIterable, and will be set as the [body of the HTTP Response](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response#body) via a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#consuming_a_fetch_as_a_stream) or other efficient method that avoids loading the entire response into memory or getting the entire response from the network before returning a response to the user.
 *
 * If your content doesn't have a mime-type or an [IPFS spec](https://specs.ipfs.tech), this library will not support it, but you can use the [`helia`](https://github.com/ipfs/helia) library directly for those use cases. See [Unsupported response types](#unsupported-response-types) for more information.
 *
 * ##### Handling response types
 *
 * For handling responses we want to follow conventions/abstractions from Fetch API where possible:
 *
 * - For JSON, assuming you abstract any differences between dag-json/dag-cbor/json/and json-file-on-unixfs, you would call `.json()` to get a JSON object.
 * - For images (or other web-relevant asset) you want to add to the DOM, use `.blob()` or `.arrayBuffer()` to get the raw bytes.
 * - For plain text in utf-8, you would call `.text()`
 * - For streaming response data, use something like `response.body.getReader()` to get a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams#consuming_a_fetch_as_a_stream).
 *
 * ##### Unsupported response types
 *
 * * Returning IPLD nodes or DAGs as JS objects is not supported, as there is no currently well-defined structure for representing this data in an [HTTP Response](https://developer.mozilla.org/en-US/docs/Web/API/Response). Instead, users should request `aplication/vnd.ipld.car` or use the [`helia`](https://github.com/ipfs/helia) library directly for this use case.
 * * Others? Open an issue or PR!
 *
 * #### Response headers
 *
 * This library will set the [HTTP Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) headers to the appropriate values for the content type according to the appropriate [IPFS Specifications](https://specs.ipfs.tech/).
 *
 * Some known header specifications:
 *
 * * https://specs.ipfs.tech/http-gateways/path-gateway/#response-headers
 * * https://specs.ipfs.tech/http-gateways/trustless-gateway/#response-headers
 * * https://specs.ipfs.tech/http-gateways/subdomain-gateway/#response-headers
 *
 * #### Possible Scenarios that could cause confusion
 *
 * ##### Attempting to fetch the CID for content that does not make sense
 *
 * If you request `bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze`, which points to the root of the en.wikipedia.org mirror, a response object does not make sense.
 *
 * #### Errors
 *
 * Known Errors that can be thrown:
 *
 * 1. `TypeError` - If the resource argument is not a string, CID, or CID string.
 * 2. `TypeError` - If the options argument is passed and not an object.
 * 3. `TypeError` - If the options argument is passed and is malformed.
 * 4. `AbortError` - If the content request is aborted due to user aborting provided AbortSignal.
 */

import { trustlessGateway } from '@helia/block-brokers'
import { createHeliaHTTP } from '@helia/http'
import { delegatedHTTPRouting } from '@helia/routers'
import { VerifiedFetch as VerifiedFetchClass } from './verified-fetch.js'
import type { Helia } from '@helia/interface'
import type { IPNSRoutingEvents, ResolveDnsLinkProgressEvents, ResolveProgressEvents } from '@helia/ipns'
import type { GetEvents } from '@helia/unixfs'
import type { CID } from 'multiformats/cid'
import type { ProgressEvent, ProgressOptions } from 'progress-events'

/**
 * The types for the first argument of the `verifiedFetch` function.
 */
export type Resource = string | CID

export interface CIDDetail {
  cid: string
  path: string
}

export interface CIDDetailError extends CIDDetail {
  error: Error
}

export interface VerifiedFetch {
  (resource: Resource, options?: VerifiedFetchInit): Promise<Response>
  start(): Promise<void>
  stop(): Promise<void>
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
  ResolveProgressEvents | ResolveDnsLinkProgressEvents | IPNSRoutingEvents

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
 * listen for progress events.
 */
export interface VerifiedFetchInit extends RequestInit, ProgressOptions<BubbledProgressEvents | VerifiedFetchProgressEvents> {
}

/**
 * Create and return a Helia node
 */
export async function createVerifiedFetch (init?: Helia | CreateVerifiedFetchWithOptions): Promise<VerifiedFetch> {
  if (!isHelia(init)) {
    init = await createHeliaHTTP({
      blockBrokers: [
        trustlessGateway({
          gateways: init?.gateways
        })
      ],
      routers: (init?.routers ?? ['https://delegated-ipfs.dev']).map((routerUrl) => delegatedHTTPRouting(routerUrl))
    })
  }

  const verifiedFetchInstance = new VerifiedFetchClass({ helia: init })
  async function verifiedFetch (resource: Resource, options?: VerifiedFetchInit): Promise<Response> {
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
