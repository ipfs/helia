import { CID } from 'multiformats/cid';
import type { ResourceType, VerifiedFetchOptions } from './interface.js';
import type { Helia } from '@helia/interface';
import { ipns, type IPNS } from '@helia/ipns'
import {unixfs, type UnixFS} from '@helia/unixfs'
import { peerIdFromString } from '@libp2p/peer-id'
import { getContentType } from './utils/get-content-type.js';

export class VerifiedFetch {
  private readonly helia: Helia;
  private readonly ipns: IPNS;
  private readonly unixfs: UnixFS;
  constructor (heliaInstance: Helia) {
    this.helia = heliaInstance
    this.ipns = ipns(heliaInstance)
    this.unixfs = unixfs(heliaInstance)
  }

  /**
   * Handles the different use cases for the `resource` argument.
   * The resource can represent an IPFS path, IPNS path, or CID.
   * If the resource represents an IPNS path, we need to resolve it to a CID.
   */
  private async parseResource (resource: ResourceType): Promise<{ cid: CID, path: string, protocol?: string }> {
    if (typeof resource === 'string') {
      // either an `ipfs://` or `ipns://` URL
      const url = new URL(resource)
      const protocol = url.protocol.slice(0, -1)
      const urlPathParts = url.pathname.slice(2).split('/')
      const cidOrPeerIdOrDnsLink = urlPathParts[0]
      const path = urlPathParts.slice(1).join('/')
      try {
        const cid = CID.parse(cidOrPeerIdOrDnsLink)
        return {
          cid,
          path,
          protocol,
        }
      } catch (err) {
        console.error(err)
        // ignore non-CID
      }

      try {
        const cid = await this.ipns.resolveDns(cidOrPeerIdOrDnsLink)
        return {
          cid,
          path,
          protocol,
        }
      } catch (err) {
        console.error(err)
        // ignore non DNSLink
      }

      try {
        const peerId = await peerIdFromString(cidOrPeerIdOrDnsLink)
        const cid = await this.ipns.resolve(peerId)
        return {
          cid,
          path,
          protocol,
        }
      } catch (err) {
        console.error(err)
        // ignore non PeerId
      }
      throw new Error(`Invalid resource. Cannot determine CID from resource: ${resource}`)
    }

    // an actual CID
    return {
      cid: resource,
      protocol: 'ipfs',
      path: ''
    }
  }

  private async getStreamAndContentType (iterator: AsyncIterable<Uint8Array>, path: string): Promise<{ contentType: string, stream: ReadableStream<Uint8Array> }> {
    const reader = iterator[Symbol.asyncIterator]()
    const { value, done } = await reader.next()
    if (done) {
      console.error('No content found')
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
        if (done) {
          controller.close()
          return
        }
        controller.enqueue(value)
      }
    })

    return { contentType, stream }
  }


  // handle vnd.ipfs.ipns-record
  private async handleIPNSRecord ({cid, path, options}: {cid: CID, path: string, options?: VerifiedFetchOptions}): Promise<Response> {
    return new Response('TODO: handleIPNSRecord', { status: 500 })
  }

  // handle vnd.ipld.car
  private async handleIPLDCar ({cid, path, options}: {cid: CID, path: string, options?: VerifiedFetchOptions}): Promise<Response> {
    return new Response('TODO: handleIPLDCar', { status: 500 })
  }

  /**
   * handle vnd.ipld.raw
   * This is the default method for fetched content.
   */
  private async handleIPLDRaw ({cid, path, options}: {cid: CID, path: string, options?: VerifiedFetchOptions}): Promise<Response> {
    const asyncIter = await this.unixfs.cat(cid, { path, signal: options?.signal })
    const { contentType, stream } = await this.getStreamAndContentType(asyncIter, path)

    const response = new Response(stream, { status: 200 })
    response.headers.set('content-type', contentType)

    return response;
  }


  async fetch (resource: ResourceType, options?: VerifiedFetchOptions): Promise<Response> {
    const { cid, path } = await this.parseResource(resource)
    let response: Response | undefined
    if (options?.headers != null) {
      const contentType = new Headers(options.headers).get('content-type')
      if (contentType != null) {
        if (contentType.includes('vnd.ipld.car')) {
          response = await this.handleIPLDCar({cid, path, options})

        } else if (contentType.includes('vnd.ipfs.ipns-record')) {
          response = await this.handleIPNSRecord({cid, path, options})
        }
      }
    }

    if (response == null) {
      response = await this.handleIPLDRaw({cid, path, options})
    }

    response.headers.set('etag', cid.toString())
    // response.headers.set('cache-cotrol', 'public, max-age=29030400, immutable')
    response.headers.set('cache-cotrol', 'no-cache') // disable caching when debugging
    response.headers.set('x-ipfs-path', path)
    response.headers.set('x-ipfs-cid', cid.toString())
    response.headers.set('x-ipfs-protocol', 'ipfs')

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
