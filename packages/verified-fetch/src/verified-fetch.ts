import { dagJson as heliaDagJson, type DAGJSON } from '@helia/dag-json'
import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps, dnsOverHttps } from '@helia/ipns/dns-resolvers'
import { json as heliaJson, type JSON as HeliaJSON } from '@helia/json'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs } from '@helia/unixfs'
import { code as dagJsonCode } from '@ipld/dag-json'
import { code as dagPbCode } from '@ipld/dag-pb'
import { logger } from '@libp2p/logger'
import { type CID } from 'multiformats/cid'
import { code as jsonCode } from 'multiformats/codecs/json'
import { CustomProgressEvent } from 'progress-events'
import { getStreamAndContentType } from './utils/get-stream-and-content-type.js'
import { parseResource } from './utils/parse-resource.js'
import type { CIDDetail, ResourceType, VerifiedFetchOptions } from './index.js'
import type { Helia } from '@helia/interface'

const log = logger('helia:verified-fetch')

interface VerifiedFetchConstructorOptions {
  helia: Helia
  ipns?: IPNS
  unixfs?: HeliaUnixFs
  dagJson?: DAGJSON
  json?: HeliaJSON
}

interface FetchHandlerFunction {
  (options: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response>
}

export class VerifiedFetch {
  private readonly helia: Helia
  private readonly ipns: IPNS
  private readonly unixfs: HeliaUnixFs
  private readonly dagJson: DAGJSON
  private readonly json: HeliaJSON

  constructor ({ helia, ipns, unixfs, dagJson, json }: VerifiedFetchConstructorOptions) {
    this.helia = helia
    this.ipns = ipns ?? heliaIpns(helia, {
      resolvers: [
        dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://dns.google/dns-query'),
        dnsJsonOverHttps('https://dns.google/resolve')
      ]
    })
    this.unixfs = unixfs ?? heliaUnixFs(helia)
    this.dagJson = dagJson ?? heliaDagJson(helia)
    this.json = json ?? heliaJson(helia)
    log.trace('created VerifiedFetch instance')
  }

  // handle vnd.ipfs.ipns-record
  private async handleIPNSRecord ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
    const response = new Response('vnd.ipfs.ipns-record support is not implemented', { status: 501 })
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  // handle vnd.ipld.car
  private async handleIPLDCar ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
    const response = new Response('vnd.ipld.car support is not implemented', { status: 501 })
    response.headers.set('X-Content-Type-Options', 'nosniff') // see https://specs.ipfs.tech/http-gateways/path-gateway/#x-content-type-options-response-header
    return response
  }

  private async handleDagJson ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
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

  private async handleJson ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
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

  private async handleDagPb ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: cid.toString(), path }))
    let stat = await this.unixfs.stat(cid, {
      path,
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: cid.toString(), path }))

    if (stat.type === 'directory') {
      const dirCid = stat.cid
      // check for redirects

      log.trace('found directory at %c/%s, looking for root files', cid, path)
      for (const rootFilePath of ['index.html', 'index.htm', 'index.shtml']) {
        try {
          log.trace('looking for file: %c/%s', dirCid, rootFilePath)
          options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: dirCid.toString(), path: rootFilePath }))
          stat = await this.unixfs.stat(dirCid, {
            path: rootFilePath,
            signal: options?.signal,
            onProgress: options?.onProgress
          })
          log.trace('found root file at %c/%s with cid %c', dirCid, rootFilePath, stat.cid)
          path = rootFilePath

          break
        } catch (err: any) {
          log('error loading path %c/%s', dirCid, rootFilePath, err)
        } finally {
          options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: dirCid.toString(), path: rootFilePath }))
        }
      }
    }

    if (stat == null || stat.type === 'directory') {
      log('Unable to find root file for directory at %c', cid)
      return new Response('Support for directories with implicit root is not implemented', { status: 501 })
    }

    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:start', { cid: stat.cid.toString(), path: '' }))
    const asyncIter = this.unixfs.cat(stat.cid, {
      signal: options?.signal,
      onProgress: options?.onProgress
    })
    options?.onProgress?.(new CustomProgressEvent<CIDDetail>('verified-fetch:request:end', { cid: stat.cid.toString(), path: '' }))
    log('got async iterator for %c/%s, stat: ', cid, path, stat)
    // now we need to pipe the stream through a transform to unmarshal unixfs data
    const { contentType, stream } = await getStreamAndContentType(asyncIter, path, {
      onProgress: options?.onProgress
    })
    const response = new Response(stream, { status: 200 })
    response.headers.set('content-type', contentType)

    return response
  }

  /**
   * Determines the format requested by the client, defaults to 'raw' for 'application/vnd.ipld.raw`
   *
   * @see https://specs.ipfs.tech/http-gateways/path-gateway/#format-request-query-parameter
   * @default 'raw'
   */
  private getFormat ({ headerFormat, queryFormat }: { headerFormat: string | null, queryFormat: string | null }): string {
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

    return 'raw'
  }

  /**
   * Map of format to specific handlers for that format.
   */
  private readonly formatHandlers: Record<string, FetchHandlerFunction> = {
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
    [jsonCode]: this.handleJson
  }

  async fetch (resource: ResourceType, options?: VerifiedFetchOptions): Promise<Response> {
    const { cid, path, query } = await parseResource(resource, this.ipns, { onProgress: options?.onProgress })
    let response: Response | undefined
    const format = this.getFormat({ headerFormat: new Headers(options?.headers).get('accept'), queryFormat: query.format ?? null })

    const formatHandler = this.formatHandlers[format]

    if (formatHandler != null) {
      response = await formatHandler.call(this, { cid, path, options })
    }

    if (response == null) {
      const codecHandler = this.codecHandlers[cid.code]
      if (codecHandler != null) {
        response = await codecHandler.call(this, { cid, path, options })
      } else {
        return new Response(`Support for codec with code ${cid.code} is not yet implemented. Please open an issue at https://github.com/ipfs/helia/issues/new`, { status: 501 })
      }
    }

    response.headers.set('etag', cid.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
    response.headers.set('cache-cotrol', 'public, max-age=29030400, immutable')
    response.headers.set('X-Ipfs-Path', resource.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-path-response-header
    // response.headers.set('X-Ipfs-Roots', 'TODO') // https://specs.ipfs.tech/http-gateways/path-gateway/#x-ipfs-roots-response-header
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
