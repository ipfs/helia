import { ipns as heliaIpns, type IPNS } from '@helia/ipns'
import { dnsJsonOverHttps, dnsOverHttps } from '@helia/ipns/dns-resolvers'
import { unixfs as heliaUnixFs, type UnixFS as HeliaUnixFs } from '@helia/unixfs'
import { logger } from '@libp2p/logger'
import { type CID } from 'multiformats/cid'
import { getContentType } from './utils/get-content-type.js'
import { parseResource } from './utils/parse-resource.js'
import type { ResourceType, VerifiedFetchOptions } from './interface.js'
import type { Helia } from '@helia/interface'

const log = logger('helia:verified-fetch')

interface VerifiedFetchConstructorOptions {
  helia: Helia
  ipns?: IPNS
  unixfs?: HeliaUnixFs
}
export class VerifiedFetch {
  private readonly helia: Helia
  private readonly ipns: IPNS
  private readonly unixfs: HeliaUnixFs
  constructor ({ helia, ipns, unixfs }: VerifiedFetchConstructorOptions) {
    this.helia = helia
    this.ipns = ipns ?? heliaIpns(helia, {
      resolvers: [
        dnsJsonOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://mozilla.cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://cloudflare-dns.com/dns-query'),
        dnsOverHttps('https://dns.google/dns-query'),
        dnsJsonOverHttps('https://dns.google/resolve'),
        dnsOverHttps('https://dns.quad9.net/dns-query')
      ]
    })
    this.unixfs = unixfs ?? heliaUnixFs(helia)
    log.trace('created VerifiedFetch instance')
  }

  private async getStreamAndContentType (iterator: AsyncIterable<Uint8Array>, path: string): Promise<{ contentType: string, stream: ReadableStream<Uint8Array> }> {
    const reader = iterator[Symbol.asyncIterator]()
    const { value, done } = await reader.next()
    if (done === true) {
      log.error('No content found')
      throw new Error('No content found')
    }

    const contentType = await getContentType({ bytes: value, path })
    const stream = new ReadableStream({
      async start (controller) {
        // the initial value is already available
        controller.enqueue(value)
      },
      async pull (controller) {
        const { value, done } = await reader.next()
        if (done === true) {
          controller.close()
          return
        }
        controller.enqueue(value)
      }
    })

    return { contentType, stream }
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

  /**
   * handle vnd.ipld.raw
   * This is the default method for fetched content.
   */
  private async handleIPLDRaw ({ cid, path, options }: { cid: CID, path: string, options?: VerifiedFetchOptions }): Promise<Response> {
    log.trace('fetching %c/%s', cid, path)
    let stat = await this.unixfs.stat(cid, {
      path,
      signal: options?.signal,
      onProgress: (evt) => {
        log.trace('%s progress event for %c/%s', evt.type, cid, path)
      }
    })
    if (stat.type === 'directory') {
      const dirCid = stat.cid
      // check for redirects

      log.trace('found directory at %c/%s, looking for root files', cid, path)
      for (const rootFilePath of ['index.html', 'index.htm', 'index.shtml']) {
        try {
          log.trace('looking for file: %c/%s', dirCid, rootFilePath)
          stat = await this.unixfs.stat(dirCid, {
            signal: options?.signal,
            path: rootFilePath
          })
          log.trace('found root file at %c/%s with cid %c', dirCid, rootFilePath, stat.cid)

          break
        } catch (err: any) {
          log('error loading path %c/%s', dirCid, rootFilePath, err)
        }
      }
    }
    if (stat.type === 'directory') {
      log('Unable to find root file for directory at %c', cid)
      return new Response('Support for directories with implicit root is not implemented', { status: 501 })
    }
    const asyncIter = this.unixfs.cat(stat.cid)
    log('got async iterator for %c/%s, stat: ', cid, path, stat)
    // now we need to pipe the stream through a transform to unmarshal unixfs data
    const { contentType, stream } = await this.getStreamAndContentType(asyncIter, path)
    const response = new Response(stream, { status: 200 })
    response.headers.set('content-type', contentType)

    return response
  }

  async fetch (resource: ResourceType, options?: VerifiedFetchOptions): Promise<Response> {
    const { cid, path, query } = await parseResource(resource, this.ipns)
    let response: Response | undefined
    const format = new Headers(options?.headers).get('accept') ?? ''
    // see https://specs.ipfs.tech/http-gateways/path-gateway/#format-request-query-parameter
    if (format != null || query.format != null) {
      if (query.format === 'car' || format.includes('vnd.ipld.car')) {
        response = await this.handleIPLDCar({ cid, path, options })
      } else if (query.format === 'ipns-record' || format.includes('vnd.ipfs.ipns-record')) {
        response = await this.handleIPNSRecord({ cid, path, options })
      } else if (query.format === 'tar' || format.includes('application/x-tar')) {
        return new Response('application/x-tar support is not implemented', { status: 501 })
      } else if (query.format === 'dag-json' || format.includes('application/vnd.ipld.dag-json')) {
        return new Response('application/vnd.ipld.dag-json support is not implemented', { status: 501 })
      } else if (query.format === 'dag-cbor' || format.includes('application/vnd.ipld.dag-cbor')) {
        return new Response('application/vnd.ipld.dag-cbor support is not implemented', { status: 501 })
      } else if (query.format === 'json' || format.includes('application/json')) {
        return new Response('application/json support is not implemented', { status: 501 })
      } else if (query.format === 'cbor' || format.includes('application/cbor')) {
        return new Response('application/cbor support is not implemented', { status: 501 })
      }
    }

    if (response == null) {
      response = await this.handleIPLDRaw({ cid, path, options })
    }

    response.headers.set('etag', cid.toString()) // https://specs.ipfs.tech/http-gateways/path-gateway/#etag-response-header
    // response.headers.set('cache-cotrol', 'public, max-age=29030400, immutable')
    response.headers.set('cache-cotrol', 'no-cache') // disable caching when debugging
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
