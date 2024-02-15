import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs, type UnixFSStats } from '@helia/unixfs'
import { code as dagCborCode } from '@ipld/dag-cbor'
import { code as dagJsonCode } from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import { code as jsonCode } from 'multiformats/codecs/json'
import { code as rawCode } from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { CustomProgressEvent } from 'progress-events'
import { dagCborToSafeJSON } from './utils/dag-cbor-to-safe-json.js'
import { getFormat } from './utils/get-format.js'
import { getStreamFromAsyncIterable } from './utils/get-stream-from-async-iterable.js'
import { parseResource } from './utils/parse-resource.js'
import { walkPath, type PathWalkerFn } from './utils/walk-path.js'
import type { CIDDetail, ContentTypeParser, Resource, VerifiedFetchInit as VerifiedFetchOptions } from './index.js'
import type { Helia } from '@helia/interface'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

interface VerifiedFetchComponents {
  helia: Helia
  ipns?: IPNS
  unixfs?: HeliaUnixFs
  pathWalker?: PathWalkerFn
}

/**
 * Potential future options for the VerifiedFetch constructor.
 */
interface VerifiedFetchInit {
  contentTypeParser?: ContentTypeParser
}

interface FetchHandlerFunctionArg {
  cid: CID
  path: string
  terminalElement?: UnixFSEntry
  options?: Omit<VerifiedFetchOptions, 'signal'> & AbortOptions

  /**
   * If present, the user has sent an accept header with this value - if the
   * content cannot be represented in this format a 406 should be returned
   */
  accept?: string
}

interface FetchHandlerFunction {
  (options: FetchHandlerFunctionArg): Promise<Response>
}

function convertOptions (options?: VerifiedFetchOptions): (Omit<VerifiedFetchOptions, 'signal'> & AbortOptions) | undefined {
  if (options == null) {
    return undefined
  }

  let signal: AbortSignal | undefined
  if (options?.signal === null) {
    signal = undefined
  }
  return {
    ...options,
    signal
  }
}

function okResponse (body?: BodyInit | null): Response {
  return new Response(body, {
    status: 200,
    statusText: 'OK'
  })
}

function notSupportedResponse (body?: BodyInit | null): Response {
  return new Response(body, {
    status: 501,
    statusText: 'Not Implemented'
  })
}

function notAcceptableResponse (body?: BodyInit | null): Response {
  return new Response(body, {
    status: 406,
    statusText: '406 Not Acceptable'
  })
}

/**
 * These are Accept header values that will cause content type sniffing to be
 * skipped and set to these values.
 */
const RAW_HEADERS = [
  'application/vnd.ipld.raw',
  'application/octet-stream'
]

/**
 * if the user has specified an `Accept` header, and it's in our list of
 * allowable "raw" format headers, use that instead of detecting the content
 * type, to avoid the user signalling that they will Accepting one mime type
 * and then receiving something different.
 */
function getOverridenRawContentType (headers?: HeadersInit): string | undefined {
  const acceptHeader = new Headers(headers).get('accept') ?? ''

  // e.g. "Accept: text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, */*;q=0.8"
  const acceptHeaders = acceptHeader.split(',')
    .map(s => s.split(';')[0])
    .map(s => s.trim())

  for (const mimeType of acceptHeaders) {
    if (mimeType === '*/*') {
      return
    }

    if (RAW_HEADERS.includes(mimeType ?? '')) {
      return mimeType
    }
  }
}

export class VerifiedFetch {
  private readonly helia: Helia
  private readonly ipns: IPNS
  private readonly unixfs: HeliaUnixFs
  private readonly pathWalker: PathWalkerFn
  private readonly log: Logger
  private readonly contentTypeParser: ContentTypeParser | undefined

  constructor ({ helia, ipns, unixfs, pathWalker }: VerifiedFetchComponents, init?: VerifiedFetchInit) {
    this.helia = helia
    this.log = helia.logger.forComponent('helia:verified-fetch')
    this.ipns = ipns ?? heliaIpns(helia, {
      resolvers: [
        dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsJsonOverHttps('https://dns.google/resolve')
      ]
    })
    this.unixfs = unixfs ?? heliaUnixFs(helia)
    this.pathWalker = pathWalker ?? walkPath
    this.contentTypeParser = init?.contentTypeParser
    this.log.trace('created VerifiedFetch instance')
  }

  // handle vnd.ipfs.ipns-record
  private async handleIPNSRecord ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const response = notSupportedResponse('vnd.ipfs.ipns-record support is not implemented')
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  // handle vnd.ipld.car
  private async handleIPLDCar ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const response = notSupportedResponse('vnd.ipld.car support is not implemented')
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  private async handleJson ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const block = await this.helia.blockstore.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    const response = okResponse(block)
    response.headers.set('content-type', 'application/json')
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    return response
  }

  private async handleDagCbor ({ cid, path, accept, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    // return body as binary
    const block = await this.helia.blockstore.get(cid)
    let body: string | Uint8Array

    try {
      body = dagCborToSafeJSON(block)
    } catch (err) {
      if (accept === 'application/json') {
        this.log('could not decode DAG-CBOR as JSON-safe, but the client sent "Accept: application/json"', err)

        return notAcceptableResponse()
      }

      this.log('could not decode DAG-CBOR as JSON-safe, falling back to `application/octet-stream`', err)
      body = block
    }

    const response = okResponse(body)
    response.headers.set('content-type', body instanceof Uint8Array ? 'application/octet-stream' : 'application/json')
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    return response
  }

  private async handleDagPb ({ cid, path, options, terminalElement }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    let resolvedCID = terminalElement?.cid ?? cid
    let stat: UnixFSStats
    if (terminalElement?.type === 'directory') {
      const dirCid = terminalElement.cid

      const rootFilePath = 'index.html'
      try {
        this.log.trace('found directory at %c/%s, looking for index.html', cid, path)
        options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: dirCid, path: rootFilePath }))
        stat = await this.unixfs.stat(dirCid, {
          path: rootFilePath,
          signal: options?.signal,
          onProgress: options?.onProgress
        })
        this.log.trace('found root file at %c/%s with cid %c', dirCid, rootFilePath, stat.cid)
        path = rootFilePath
        resolvedCID = stat.cid
        // terminalElement = stat
      } catch (err: any) {
        this.log('error loading path %c/%s', dirCid, rootFilePath, err)
        return notSupportedResponse('Unable to find index.html for directory at given path. Support for directories with implicit root is not implemented')
      } finally {
        options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: dirCid, path: rootFilePath }))
      }
    }

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: resolvedCID, path: '' }))
    const asyncIter = this.unixfs.cat(resolvedCID, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    this.log('got async iterator for %c/%s', cid, path)

    const { stream, firstChunk } = await getStreamFromAsyncIterable(asyncIter, path ?? '', this.helia.logger, {
      onProgress: options?.onProgress
    })
    const response = okResponse(stream)
    await this.setContentType(firstChunk, path, response)

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: resolvedCID, path: '' }))

    return response
  }

  private async handleRaw ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const result = await this.helia.blockstore.get(cid)
    const response = okResponse(result)

    // if the user has specified an `Accept` header that corresponds to a raw
    // type, honour that header, so they don't request `vnd.ipld.raw` and get
    // `octet-stream` or vice versa
    const overriddenContentType = getOverridenRawContentType(options?.headers)
    if (overriddenContentType != null) {
      response.headers.set('content-type', overriddenContentType)
    } else {
      await this.setContentType(result, path, response)
    }

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    return response
  }

  private async setContentType (bytes: Uint8Array, path: string, response: Response): Promise<void> {
    let contentType = 'application/octet-stream'

    if (this.contentTypeParser != null) {
      try {
        let fileName = path.split('/').pop()?.trim()
        fileName = fileName === '' ? undefined : fileName
        const parsed = this.contentTypeParser(bytes, fileName)

        if (isPromise(parsed)) {
          const result = await parsed

          if (result != null) {
            contentType = result
          }
        } else if (parsed != null) {
          contentType = parsed
        }
      } catch (err) {
        this.log.error('Error parsing content type', err)
      }
    }

    response.headers.set('content-type', contentType)
  }

  /**
   * Map of format to specific handlers for that format.
   *
   * These format handlers should adjust the response headers as specified in
   * https://specs.ipfs.tech/http-gateways/path-gateway/#response-headers
   */
  private readonly formatHandlers: Record<string, FetchHandlerFunction> = {
    raw: this.handleRaw,
    car: this.handleIPLDCar,
    'ipns-record': this.handleIPNSRecord,
    tar: async () => notSupportedResponse('application/x-tar support is not implemented'),
    'dag-json': this.handleJson,
    'dag-cbor': this.handleDagCbor,
    json: this.handleJson,
    cbor: this.handleDagCbor
  }

  /**
   * If the user has not specified an Accept header or format query string arg,
   * use the CID codec to choose an appropriate handler for the block data.
   */
  private readonly codecHandlers: Record<number, FetchHandlerFunction> = {
    [dagPbCode]: this.handleDagPb,
    [dagJsonCode]: this.handleJson,
    [jsonCode]: this.handleJson,
    [dagCborCode]: this.handleDagCbor,
    [rawCode]: this.handleRaw,
    [identity.code]: this.handleRaw
  }

  async fetch (resource: Resource, opts?: VerifiedFetchOptions): Promise<Response> {
    this.log('fetch', resource)

    const options = convertOptions(opts)
    const { path, query, ...rest } = await parseResource(resource, { ipns: this.ipns, logger: this.helia.logger }, options)
    const cid = rest.cid
    let response: Response | undefined

    const acceptHeader = new Headers(options?.headers).get('accept')
    this.log('accept header %s', acceptHeader)

    const format = getFormat({ cid, headerFormat: acceptHeader, queryFormat: query.format ?? null })
    this.log('format %s, mime type %s', format?.format, format?.mimeType)

    if (format == null && acceptHeader != null) {
      this.log('no format found for accept header %s', acceptHeader)

      // user specified an Accept header but we had no handler for it
      return notAcceptableResponse()
    }

    if (format != null) {
      // TODO: These should be handled last when they're returning something other than 501
      const formatHandler = this.formatHandlers[format.format]

      if (formatHandler != null) {
        response = await formatHandler.call(this, { cid, path, accept: format.mimeType, options })

        if (response.status === 501) {
          return response
        }
      }
    }

    let terminalElement: UnixFSEntry | undefined
    let ipfsRoots: CID[] | undefined

    try {
      const pathDetails = await this.pathWalker(this.helia.blockstore, `${cid.toString()}/${path}`, options)
      ipfsRoots = pathDetails.ipfsRoots
      terminalElement = pathDetails.terminalElement
    } catch (err) {
      this.log.error('Error walking path %s', path, err)
      // return new Response(`Error walking path: ${(err as Error).message}`, { status: 500 })
    }

    if (response == null) {
      const codecHandler = this.codecHandlers[cid.code]

      if (codecHandler != null) {
        response = await codecHandler.call(this, { cid, path, options, terminalElement })
      } else {
        return notSupportedResponse(`Support for codec with code ${cid.code} is not yet implemented. Please open an issue at https://github.com/ipfs/helia/issues/new`)
      }
    }

    const contentType = response.headers.get('content-type')

    if (format != null && format.mimeType !== '*/*' && contentType !== format.mimeType) {
      // the user requested a specific, non-wildcard representation type, but
      // the data cannot be represented as that type so return a
      // "Not Acceptable" response
      return notAcceptableResponse()
    }

    response.headers.set('etag', cid.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
    response.headers.set('cache-control', 'public, max-age=29030400, immutable')
    response.headers.set('X-Ipfs-Path', resource.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-path-response-header

    if (ipfsRoots != null) {
      response.headers.set('X-Ipfs-Roots', ipfsRoots.map(cid => cid.toV1().toString()).join(',')) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-roots-response-header
    }
    // response.headers.set('Content-Disposition', `TODO`) // https://specs.ipfs.tech/http-gateways/path-gateway/#content-disposition-response-header

    return response
  }

  /**
   * Start the Helia instance
   */
  async start (): Promise<void> {
    await this.helia.start()
  }

  /**
   * Shut down the Helia instance
   */
  async stop (): Promise<void> {
    await this.helia.stop()
  }
}

function isPromise <T> (p?: any): p is Promise<T> {
  return p?.then != null
}
