import { isPrivateIp } from '@libp2p/utils/private-ip'
import { DNS, HTTP, HTTPS } from '@multiformats/multiaddr-matcher'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { Uint8ArrayList } from 'uint8arraylist'
import { TrustlessGateway } from './trustless-gateway.js'
import type { TransformRequestInit } from './trustless-gateway.js'
import type { Routing } from '@helia/interface'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { AbortOptions, Multiaddr } from '@multiformats/multiaddr'
import type { CID } from 'multiformats/cid'

export function filterNonHTTPMultiaddrs (multiaddrs: Multiaddr[], allowInsecure: boolean, allowLocal: boolean): Multiaddr[] {
  return multiaddrs.filter(ma => {
    if (HTTPS.matches(ma) || (allowInsecure && HTTP.matches(ma))) {
      if (allowLocal) {
        return true
      }

      if (DNS.matches(ma)) {
        return true
      }

      return isPrivateIp(ma.toOptions().host) === false
    }

    // When allowInsecure is false and allowLocal is true, allow multiaddrs with "127.0.0.1", "localhost", or any subdomain ending with ".localhost"
    if (!allowInsecure && allowLocal) {
      const { host } = ma.toOptions()
      if (host === '127.0.0.1' || host === 'localhost' || host.endsWith('.localhost')) {
        return true
      }
    }

    return false
  })
}

export interface FindHttpGatewayProvidersOptions extends AbortOptions {
  transformRequestInit?: TransformRequestInit
}

export async function * findHttpGatewayProviders (cid: CID, routing: Routing, logger: ComponentLogger, allowInsecure: boolean, allowLocal: boolean, options: FindHttpGatewayProvidersOptions = {}): AsyncGenerator<TrustlessGateway> {
  for await (const provider of routing.findProviders(cid, options)) {
    // require http(s) addresses
    const httpAddresses = filterNonHTTPMultiaddrs(provider.multiaddrs, allowInsecure, allowLocal)

    if (httpAddresses.length === 0) {
      continue
    }

    // take first address?
    // /ip4/x.x.x.x/tcp/31337/http
    // /ip4/x.x.x.x/tcp/31337/https
    // etc
    const uri = multiaddrToUri(httpAddresses[0])

    yield new TrustlessGateway(uri, { logger, transformRequestInit: options.transformRequestInit })
  }
}

interface LimitedResponseOptions {
  signal?: AbortSignal
  log?: Logger
}

/**
 * A function that handles ensuring the content-length header and the response body is less than a given byte limit.
 *
 * If the response contains a content-length header greater than the limit or the actual bytes returned are greater than
 * the limit, an error is thrown.
 */
export async function limitedResponse (response: Response, byteLimit: number, options?: LimitedResponseOptions): Promise<Uint8Array> {
  const { signal, log } = options ?? {}
  const contentLength = response.headers.get('content-length')
  if (contentLength != null) {
    const contentLengthNumber = parseInt(contentLength, 10)
    if (contentLengthNumber > byteLimit) {
      log?.error('content-length header (%d) is greater than the limit (%d)', contentLengthNumber, byteLimit)
      if (response.body != null) {
        await response.body.cancel().catch(err => {
          log?.error('error cancelling response body after content-length check - %e', err)
        })
      }
      throw new Error(`Content-Length header (${contentLengthNumber}) is greater than the limit (${byteLimit}).`)
    }
  }

  const reader = response.body?.getReader()
  if (reader == null) {
    // no body to consume if reader is null
    throw new Error('Response body is not readable')
  }

  const chunkList = new Uint8ArrayList()

  try {
    while (true) {
      if (signal?.aborted === true) {
        throw new Error('Response body read was aborted.')
      }

      const { done, value } = await reader.read()
      if (done) {
        break
      }

      chunkList.append(value)

      if (chunkList.byteLength > byteLimit) {
        // No need to consume body here, as we were streaming and hit the limit
        throw new Error(`Response body is greater than the limit (${byteLimit}), received ${chunkList.byteLength} bytes.`)
      }
    }
  } finally {
    reader.cancel()
      .catch(err => {
        log?.error('error cancelling reader - %e', err)
      })
      .finally(() => {
        reader.releaseLock()
      })
  }

  return chunkList.subarray()
}
