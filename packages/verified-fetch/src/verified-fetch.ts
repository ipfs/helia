import { dagCbor as heliaDagCbor, type DAGCBOR } from '@helia/dag-cbor'
import { dagJson as heliaDagJson, type DAGJSON } from '@helia/dag-json'
import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps } from '@helia/ipns/dns-resolvers'
import { json as heliaJson, type JSON as HeliaJSON } from '@helia/json'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs, type UnixFSStats } from '@helia/unixfs'
import { code as dagCborCode } from '@ipld/dag-cbor'
import { code as dagJsonCode } from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { type CID } from 'multiformats/cid'
import { code as jsonCode } from 'multiformats/codecs/json'
import { CustomProgressEvent } from 'progress-events'
import { getStreamAndContentType } from './utils/get-stream-and-content-type.js'
import { parseResource } from './utils/parse-resource.js'
import { walkPath, type PathWalkerFn } from './utils/walk-path.js'
import type { CIDDetail, ResourceType, VerifiedFetchOptionsMod } from './index.js'
import type { Helia } from '@helia/interface'
import type { UnixFSEntry } from 'ipfs-unixfs-exporter'

const log = logger('helia:verified-fetch')

interface VerifiedFetchConstructorComponents {
  helia: Helia
  ipns?: IPNS
  unixfs?: HeliaUnixFs
  dagJson?: DAGJSON
  json?: HeliaJSON
  dagCbor?: DAGCBOR
  pathWalker?: PathWalkerFn
}

/**
 * Potential future options for the VerifiedFetch constructor.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface VerifiedFetchConstructorOptions {

}

interface FetchHandlerFunctionArg {
  cid: CID
  path: string
  terminalElement?: UnixFSEntry
  options?: VerifiedFetchOptionsMod
}

interface FetchHandlerFunction {
  (options: FetchHandlerFunctionArg): Promise<Response>
}

export class VerifiedFetch {
  private readonly helia: Helia
  private readonly ipns: IPNS
  private readonly unixfs: HeliaUnixFs
  private readonly dagJson: DAGJSON
  private readonly dagCbor: DAGCBOR
  private readonly json: HeliaJSON
  private readonly pathWalker: PathWalkerFn

  constructor ({ helia, ipns, unixfs, dagJson, json, dagCbor, pathWalker }: VerifiedFetchConstructorComponents, options?: VerifiedFetchConstructorOptions) {
    this.helia = helia
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
    log.trace('created VerifiedFetch instance')
  }

  // handle vnd.ipfs.ipns-record
  private async handleIPNSRecord ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const response = new Response('vnd.ipfs.ipns-record support is not implemented', { status: 501 })
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  // handle vnd.ipld.car
  private async handleIPLDCar ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    const response = new Response('vnd.ipld.car support is not implemented', { status: 501 })
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  private async handleDagJson ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: cid.toString(), path }))
    const result = await this.dagJson.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: cid.toString(), path }))
    const response = new Response(JSON.stringify(result), { status: 200 })
    response.headers.set('content-type', 'application/json')
    return response
  }

  private async handleJson ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: cid.toString(), path }))
    const result: Record<any, any> = await this.json.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: cid.toString(), path }))
    const response = new Response(JSON.stringify(result), { status: 200 })
    response.headers.set('content-type', 'application/json')
    return response
  }

  private async handleDagCbor ({ cid, path, options }: FetchHandlerFunctionArg): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: cid.toString(), path }))
    const result = await this.dagCbor.get(cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: cid.toString(), path }))
    const response = new Response(JSON.stringify(result), { status: 200 })
    response.headers.set('content-type', 'application/json')
    return response
  }

  private async handleDagPb ({ cid, path, options, terminalElement }: FetchHandlerFunctionArg): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    let resolvedCID = terminalElement?.cid ?? cid
    let stat: UnixFSStats
    if (terminalElement?.type === 'directory') {
      const dirCid = terminalElement.cid

      const rootFilePath = 'index.html'
      try {
        log.trace('found directory at %c/%s, looking for index.html', cid, path)
        options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: dirCid.toString(), path: rootFilePath }))
        stat = await this.unixfs.stat(dirCid, {
          path: rootFilePath,
          signal: options?.signal,
          onProgress: options?.onProgress
        })
        log.trace('found root file at %c/%s with cid %c', dirCid, rootFilePath, stat.cid)
        path = rootFilePath
        resolvedCID = stat.cid
        // terminalElement = stat
      } catch (err: any) {
        log('error loading path %c/%s', dirCid, rootFilePath, err)
        return new Response('Unable to find index.html for directory at given path. Support for directories with implicit root is not implemented', { status: 501 })
      } finally {
        options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: dirCid.toString(), path: rootFilePath }))
      }
    }

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: resolvedCID.toString(), path: '' }))
    const asyncIter = this.unixfs.cat(resolvedCID, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: resolvedCID.toString(), path: '' }))
    log('got async iterator for %c/%s', cid, path)

    const { contentType, stream } = await getStreamAndContentType(asyncIter, path ?? '', {
      onProgress: options?.onProgress
    })
    const response = new Response(stream, { status: 200 })
    response.headers.set('content-type', contentType)

    return response
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
    raw: async () => new Response('application/vnd.ipld.raw support is not implemented', { status: 501 }),
    car: this.handleIPLDCar,
    'ipns-record': this.handleIPNSRecord,
    tar: async () => new Response('application/x-tar support is not implemented', { status: 501 }),
    'dag-json': async () => new Response('application/vnd.ipld.dag-json support is not implemented', { status: 501 }),
    'dag-cbor': async () => new Response('application/vnd.ipld.dag-cbor support is not implemented', { status: 501 }),
    json: async () => new Response('application/json support is not implemented', { status: 501 }),
    cbor: async () => new Response('application/cbor support is not implemented', { status: 501 })
  }

  private readonly codecHandlers: Record<number, FetchHandlerFunction> = {
    [dagJsonCode]: this.handleDagJson,
    [dagPbCode]: this.handleDagPb,
    [jsonCode]: this.handleJson,
    [dagCborCode]: this.handleDagCbor
  }

  async fetch (resource: ResourceType, options?: VerifiedFetchOptionsMod): Promise<Response> {
    const { path, query, ...rest } = await parseResource(resource, this.ipns, { onProgress: options?.onProgress })
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
    let ipfsRoots: string | undefined
    try {
      const pathDetails = await this.pathWalker(this.helia.blockstore, `${cid.toString()}/${path}`, options)
      ipfsRoots = pathDetails.ipfsRoots.join(',')
      terminalElement = pathDetails.terminalElement
    } catch (err) {
      log.error('Error walking path %s', path, err)
      // return new Response(`Error walking path: ${(err as Error).message}`, { status: 500 })
    }

    if (response == null) {
      const codecHandler = this.codecHandlers[cid.code]
      if (codecHandler != null) {
        response = await codecHandler.call(this, { cid, path, options, terminalElement })
      } else {
        return new Response(`Support for codec with code ${cid.code} is not yet implemented. Please open an issue at https://github.com/ipfs/helia/issues/new`, { status: 501 })
      }
    }

    response.headers.set('etag', cid.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
    response.headers.set('cache-cotrol', 'public, max-age=29030400, immutable')
    response.headers.set('X-Ipfs-Path', resource.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-path-response-header
    if (ipfsRoots != null) {
      response.headers.set('X-Ipfs-Roots', ipfsRoots) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-roots-response-header
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
