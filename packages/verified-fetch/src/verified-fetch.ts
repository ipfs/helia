import { car } from '@helia/car'
import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs, type UnixFSStats } from '@helia/unixfs'
import { CarWriter } from '@ipld/car'
import * as ipldDagCbor from '@ipld/dag-cbor'
import * as ipldDagJson from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import toBrowserReadableStream from 'it-to-browser-readablestream'
import { code as jsonCode } from 'multiformats/codecs/json'
import { code as rawCode } from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { CustomProgressEvent } from 'progress-events'
import { dagCborToSafeJSON } from './utils/dag-cbor-to-safe-json.js'
import { getContentDispositionFilename } from './utils/get-content-disposition-filename.js'
import { getETag } from './utils/get-e-tag.js'
import { getStreamFromAsyncIterable } from './utils/get-stream-from-async-iterable.js'
import { tarStream } from './utils/get-tar-stream.js'
import { parseResource } from './utils/parse-resource.js'
import { selectOutputType, queryFormatToAcceptHeader } from './utils/select-output-type.js'
import { walkPath } from './utils/walk-path.js'
import type { CIDDetail, ContentTypeParser, Resource, VerifiedFetchInit as VerifiedFetchOptions } from './index.js'
import type { RequestFormatShorthand } from './types.js'
import type { Helia } from '@helia/interface'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'
import type { CID } from 'multiformats/cid'

interface VerifiedFetchComponents {
  helia: Helia
  ipns?: IPNS
  unixfs?: HeliaUnixFs
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
  const response = new Response(body, {
    status: 501,
    statusText: 'Not Implemented'
  })
  response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
  return response
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
  private readonly log: Logger
  private readonly contentTypeParser: ContentTypeParser | undefined

  constructor ({ helia, ipns, unixfs }: VerifiedFetchComponents, init?: VerifiedFetchInit) {
    this.helia = helia
    this.log = helia.logger.forComponent('helia:verified-fetch')
    this.ipns = ipns ?? heliaIpns(helia, {
      resolvers: [
        dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsJsonOverHttps('https://dns.google/resolve')
      ]
    })
    this.unixfs = unixfs ?? heliaUnixFs(helia)
    this.contentTypeParser = init?.contentTypeParser
    this.log.trace('created VerifiedFetch instance')
  }

  /**
   * Accepts an `ipns://...` URL as a string and returns a `Response` containing
   * a raw IPNS record.
   */
  private async handleIPNSRecord (resource: string, opts?: VerifiedFetchOptions): Promise<Response> {
    return notSupportedResponse('vnd.ipfs.ipns-record support is not implemented')
  }

  /**
   * Accepts a `CID` and returns a `Response` with a body stream that is a CAR
   * of the `DAG` referenced by the `CID`.
   */
  private async handleCar ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const c = car(this.helia)
    const { writer, out } = CarWriter.create(cid)

    const stream = toBrowserReadableStream<Uint8Array>(async function * () {
      yield * out
    }())

    // write the DAG behind `cid` into the writer
    c.export(cid, writer, options)
      .catch(err => {
        this.log.error('could not write car', err)
        stream.cancel(err)
          .catch(err => {
            this.log.error('could not cancel stream after car export error', err)
          })
      })

    const response = okResponse(stream)
    response.headers.set('content-type', 'application/vnd.ipld.car; version=1')

    return response
  }

  /**
   * Accepts a UnixFS `CID` and returns a `.tar` file containing the file or
   * directory structure referenced by the `CID`.
   */
  private async handleTar ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    if (cid.code !== dagPbCode && cid.code !== rawCode) {
      return notAcceptableResponse('only UnixFS data can be returned in a TAR file')
    }

    const stream = toBrowserReadableStream<Uint8Array>(tarStream(`/ipfs/${cid}/${path}`, this.helia.blockstore, options))

    const response = okResponse(stream)
    response.headers.set('content-type', 'application/x-tar')

    return response
  }

  private async handleJson ({ cid, path, accept, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    const block = await this.helia.blockstore.get(cid, options)
    let body: string | Uint8Array

    if (accept === 'application/vnd.ipld.dag-cbor' || accept === 'application/cbor') {
      try {
        // if vnd.ipld.dag-cbor has been specified, convert to the format - note
        // that this supports more data types than regular JSON, the content-type
        // response header is set so the user knows to process it differently
        const obj = ipldDagJson.decode(block)
        body = ipldDagCbor.encode(obj)
      } catch (err) {
        this.log.error('could not transform %c to application/vnd.ipld.dag-cbor', err)
        return notAcceptableResponse()
      }
    } else {
      // skip decoding
      body = block
    }

    const response = okResponse(body)
    response.headers.set('content-type', accept ?? 'application/json')
    return response
  }

  private async handleDagCbor ({ cid, path, accept, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)

    const block = await this.helia.blockstore.get(cid, options)
    let body: string | Uint8Array

    if (accept === 'application/octet-stream' || accept === 'application/vnd.ipld.dag-cbor' || accept === 'application/cbor') {
      // skip decoding
      body = block
    } else if (accept === 'application/vnd.ipld.dag-json') {
      try {
        // if vnd.ipld.dag-json has been specified, convert to the format - note
        // that this supports more data types than regular JSON, the content-type
        // response header is set so the user knows to process it differently
        const obj = ipldDagCbor.decode(block)
        body = ipldDagJson.encode(obj)
      } catch (err) {
        this.log.error('could not transform %c to application/vnd.ipld.dag-json', err)
        return notAcceptableResponse()
      }
    } else {
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
    }

    const response = okResponse(body)

    if (accept == null) {
      accept = body instanceof Uint8Array ? 'application/octet-stream' : 'application/json'
    }

    response.headers.set('content-type', accept)

    return response
  }

  private async handleDagPb ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    let terminalElement: UnixFSEntry | undefined
    let ipfsRoots: CID[] | undefined

    try {
      const pathDetails = await walkPath(this.helia.blockstore, `${cid.toString()}/${path}`, options)
      ipfsRoots = pathDetails.ipfsRoots
      terminalElement = pathDetails.terminalElement
    } catch (err) {
      this.log.error('Error walking path %s', path, err)
      // return new Response(`Error walking path: ${(err as Error).message}`, { status: 500 })
    }

    let resolvedCID = terminalElement?.cid ?? cid
    let stat: UnixFSStats
    if (terminalElement?.type === 'directory') {
      const dirCid = terminalElement.cid

      const rootFilePath = 'index.html'
      try {
        this.log.trace('found directory at %c/%s, looking for index.html', cid, path)
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

    if (ipfsRoots != null) {
      response.headers.set('X-Ipfs-Roots', ipfsRoots.map(cid => cid.toV1().toString()).join(',')) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-roots-response-header
    }

    return response
  }

  private async handleRaw ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const result = await this.helia.blockstore.get(cid, options)
    const response = okResponse(result)

    // if the user has specified an `Accept` header that corresponds to a raw
    // type, honour that header, so for example they don't request
    // `application/vnd.ipld.raw` but get `application/octet-stream`
    const overriddenContentType = getOverridenRawContentType(options?.headers)
    if (overriddenContentType != null) {
      response.headers.set('content-type', overriddenContentType)
    } else {
      await this.setContentType(result, path, response)
    }

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
   * If the user has not specified an Accept header or format query string arg,
   * use the CID codec to choose an appropriate handler for the block data.
   */
  private readonly codecHandlers: Record<number, FetchHandlerFunction> = {
    [dagPbCode]: this.handleDagPb,
    [ipldDagJson.code]: this.handleJson,
    [jsonCode]: this.handleJson,
    [ipldDagCbor.code]: this.handleDagCbor,
    [rawCode]: this.handleRaw,
    [identity.code]: this.handleRaw
  }

  async fetch (resource: Resource, opts?: VerifiedFetchOptions): Promise<Response> {
    this.log('fetch %s', resource)

    const options = convertOptions(opts)

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { resource }))

    // resolve the CID/path from the requested resource
    const { path, query, cid } = await parseResource(resource, { ipns: this.ipns, logger: this.helia.logger }, options)

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:resolve', { cid, path }))

    const requestHeaders = new Headers(options?.headers)
    const incomingAcceptHeader = requestHeaders.get('accept')

    if (incomingAcceptHeader != null) {
      this.log('incoming accept header "%s"', incomingAcceptHeader)
    }

    const queryFormatMapping = queryFormatToAcceptHeader(query.format)

    if (query.format != null) {
      this.log('incoming query format "%s", mapped to %s', query.format, queryFormatMapping)
    }

    const acceptHeader = incomingAcceptHeader ?? queryFormatMapping
    const accept = selectOutputType(cid, acceptHeader)
    this.log('output type %s', accept)

    if (acceptHeader != null && accept == null) {
      return notAcceptableResponse()
    }

    let response: Response
    let reqFormat: RequestFormatShorthand | undefined

    if (accept === 'application/vnd.ipfs.ipns-record') {
      // the user requested a raw IPNS record
      reqFormat = 'ipns-record'
      response = await this.handleIPNSRecord(resource.toString(), options)
    } else if (accept === 'application/vnd.ipld.car') {
      // the user requested a CAR file
      reqFormat = 'car'
      query.download = true
      query.filename = query.filename ?? `${cid.toString()}.car`
      response = await this.handleCar({ cid, path, options })
    } else if (accept === 'application/vnd.ipld.raw') {
      // the user requested a raw block
      reqFormat = 'raw'
      query.download = true
      query.filename = query.filename ?? `${cid.toString()}.bin`
      response = await this.handleRaw({ cid, path, options })
    } else if (accept === 'application/x-tar') {
      // the user requested a TAR file
      reqFormat = 'tar'
      query.download = true
      query.filename = query.filename ?? `${cid.toString()}.tar`
      response = await this.handleTar({ cid, path, options })
    } else {
      // derive the handler from the CID type
      const codecHandler = this.codecHandlers[cid.code]

      if (codecHandler == null) {
        return notSupportedResponse(`Support for codec with code ${cid.code} is not yet implemented. Please open an issue at https://github.com/ipfs/helia/issues/new`)
      }

      response = await codecHandler.call(this, { cid, path, accept, options })
    }

    response.headers.set('etag', getETag({ cid, reqFormat, weak: false }))
    response.headers.set('cache-control', 'public, max-age=29030400, immutable')
    // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-path-response-header
    response.headers.set('X-Ipfs-Path', resource.toString())

    // set Content-Disposition header
    let contentDisposition: string | undefined

    // force download if requested
    if (query.download === true) {
      contentDisposition = 'attachment'
    }

    // override filename if requested
    if (query.filename != null) {
      if (contentDisposition == null) {
        contentDisposition = 'inline'
      }

      contentDisposition = `${contentDisposition}; ${getContentDispositionFilename(query.filename)}`
    }

    if (contentDisposition != null) {
      response.headers.set('Content-Disposition', contentDisposition)
    }

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))

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
