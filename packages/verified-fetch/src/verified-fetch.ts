import { dagCbor as heliaDagCbor, type DAGCBOR } from '@helia/dag-cbor'
import { dagJson as heliaDagJson, type DAGJSON } from '@helia/dag-json'
import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
import { json as heliaJson, type JSON } from '@helia/json'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs, type UnixFSStats } from '@helia/unixfs'
import { code as dagCborCode } from '@ipld/dag-cbor'
import { code as dagJsonCode } from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import { code as jsonCode } from 'multiformats/codecs/json'
import { decode, code as rawCode } from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { CustomProgressEvent } from 'progress-events'
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
  dagJson?: DAGJSON
  json?: JSON
  dagCbor?: DAGCBOR
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

export class VerifiedFetch {
  private readonly helia: Helia
  private readonly ipns: IPNS
  private readonly unixfs: HeliaUnixFs
  private readonly dagJson: DAGJSON
  private readonly dagCbor: DAGCBOR
  private readonly json: JSON
  private readonly pathWalker: PathWalkerFn
  private readonly log: Logger
  private readonly contentTypeParser: ContentTypeParser | undefined

  constructor ({ helia, ipns, unixfs, dagJson, json, dagCbor, pathWalker }: VerifiedFetchComponents, init?: VerifiedFetchInit) {
    this.helia = helia
    this.log = helia.logger.forComponent('helia:verified-fetch')
    this.ipns = ipns ?? heliaIpns(helia, {
      resolvers: [
        dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsJsonOverHttps('https://dns.google/resolve')
      ]
    })
    this.unixfs = unixfs ?? heliaUnixFs(helia)
    this.dagJson = dagJson ?? heliaDagJson(helia)
    this.json = json ?? heliaJson(helia)
    this.dagCbor = dagCbor ?? heliaDagCbor(helia)
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

  private async handleDagJson ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const result = await this.dagJson.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    // return body as binary
    const body = await this.helia.blockstore.get(cid)
    const response = okResponse(body)
    // return pre-parsed object with embedded CIDs as objects
    response.json = async () => result
    response.headers.set('content-type', 'application/json')
    return response
  }

  private async handleJson ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const result: Record<any, any> = await this.json.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    const response = okResponse(JSON.stringify(result))
    response.headers.set('content-type', 'application/json')
    return response
  }

  private async handleDagCbor ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const result = await this.dagCbor.get<Uint8Array>(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    // return body as binary
    const body = await this.helia.blockstore.get(cid)
    const response = okResponse(body)
    // return pre-parsed object with embedded CIDs as objects
    response.json = async () => result
    await this.setContentType(result, path, response)
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
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: resolvedCID, path: '' }))
    this.log('got async iterator for %c/%s', cid, path)

    const { stream, firstChunk } = await getStreamFromAsyncIterable(asyncIter, path ?? '', this.helia.logger, {
      onProgress: options?.onProgress
    })
    const response = okResponse(stream)
    await this.setContentType(firstChunk, path, response)

    return response
  }

  private async handleRaw ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    this.log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid, path }))
    const result = await this.helia.blockstore.get(cid)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid, path }))
    const response = okResponse(decode(result))
    await this.setContentType(result, path, response)
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
   * Determines the format requested by the client, defaults to `null` if no format is requested.
   *
   * @see https://specs.ipfs.tech/http-gateways/path-gateway/#format-request-query-parameter
   * @default 'raw'
   */
  private getFormat ({ headerFormat, queryFormat }: { headerFormat: string | null, queryFormat: string | null }): string | null {
    const formatMap: Record<string, string> = {
      'vnd.ipld.raw': 'raw',
      'vnd.ipld.car': 'car',
      'application/x-tar': 'tar',
      'application/vnd.ipld.dag-json': 'dag-json',
      'application/vnd.ipld.dag-cbor': 'dag-cbor',
      'application/json': 'json',
      'application/cbor': 'cbor',
      'vnd.ipfs.ipns-record': 'ipns-record'
    }

    if (headerFormat != null) {
      for (const format in formatMap) {
        if (headerFormat.includes(format)) {
          return formatMap[format]
        }
      }
    } else if (queryFormat != null) {
      return queryFormat
    }

    return null
  }

  /**
   * Map of format to specific handlers for that format.
   * These format handlers should adjust the response headers as specified in https://specs.ipfs.tech/http-gateways/path-gateway/#response-headers
   */
  private readonly formatHandlers: Record<string, FetchHandlerFunction> = {
    raw: async () => notSupportedResponse('application/vnd.ipld.raw support is not implemented'),
    car: this.handleIPLDCar,
    'ipns-record': this.handleIPNSRecord,
    tar: async () => notSupportedResponse('application/x-tar support is not implemented'),
    'dag-json': async () => notSupportedResponse('application/vnd.ipld.dag-json support is not implemented'),
    'dag-cbor': async () => notSupportedResponse('application/vnd.ipld.dag-cbor support is not implemented'),
    json: async () => notSupportedResponse('application/json support is not implemented'),
    cbor: async () => notSupportedResponse('application/cbor support is not implemented')
  }

  private readonly codecHandlers: Record<number, FetchHandlerFunction> = {
    [dagJsonCode]: this.handleDagJson,
    [dagPbCode]: this.handleDagPb,
    [jsonCode]: this.handleJson,
    [dagCborCode]: this.handleDagCbor,
    [rawCode]: this.handleRaw,
    [identity.code]: this.handleRaw
  }

  async fetch (resource: Resource, opts?: VerifiedFetchOptions): Promise<Response> {
    const options = convertOptions(opts)
    const { path, query, ...rest } = await parseResource(resource, { ipns: this.ipns, logger: this.helia.logger }, options)
    const cid = rest.cid
    let response: Response | undefined

    const format = this.getFormat({ headerFormat: new Headers(options?.headers).get('accept'), queryFormat: query.format ?? null })

    if (format != null) {
      // TODO: These should be handled last when they're returning something other than 501
      const formatHandler = this.formatHandlers[format]

      if (formatHandler != null) {
        response = await formatHandler.call(this, { cid, path, options })

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

    response.headers.set('etag', cid.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
    response.headers.set('cache-cotrol', 'public, max-age=29030400, immutable')
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
