import { peerIdFromString } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'
import { TLRU } from './tlru.js'
import type { RequestFormatShorthand } from '../types.js'
import type { IPNS, IPNSRoutingEvents, ResolveDnsLinkProgressEvents, ResolveProgressEvents, ResolveResult } from '@helia/ipns'
import type { ComponentLogger } from '@libp2p/interface'
import type { ProgressOptions } from 'progress-events'

const ipnsCache = new TLRU<ResolveResult>(1000)

export interface ParseUrlStringInput {
  urlString: string
  ipns: IPNS
  logger: ComponentLogger
}
export interface ParseUrlStringOptions extends ProgressOptions<ResolveProgressEvents | IPNSRoutingEvents | ResolveDnsLinkProgressEvents> {

}

export interface ParsedUrlQuery extends Record<string, string | unknown> {
  format?: RequestFormatShorthand
  download?: boolean
  filename?: string
}

export interface ParsedUrlStringResults {
  protocol: string
  path: string
  cid: CID
  query: ParsedUrlQuery
}

const URL_REGEX = /^(?<protocol>ip[fn]s):\/\/(?<cidOrPeerIdOrDnsLink>[^/$?]+)\/?(?<path>[^$?]*)\??(?<queryString>.*)$/

/**
 * A function that parses ipfs:// and ipns:// URLs, returning an object with easily recognizable properties.
 *
 * After determining the protocol successfully, we process the cidOrPeerIdOrDnsLink:
 * * If it's ipfs, it parses the CID or throws an Aggregate error
 * * If it's ipns, it attempts to resolve the PeerId and then the DNSLink. If both fail, an Aggregate error is thrown.
 */
export async function parseUrlString ({ urlString, ipns, logger }: ParseUrlStringInput, options?: ParseUrlStringOptions): Promise<ParsedUrlStringResults> {
  const log = logger.forComponent('helia:verified-fetch:parse-url-string')
  const match = urlString.match(URL_REGEX)

  if (match == null || match.groups == null) {
    throw new TypeError(`Invalid URL: ${urlString}, please use ipfs:// or ipns:// URLs only.`)
  }

  const { protocol, cidOrPeerIdOrDnsLink, path: urlPath, queryString } = match.groups

  let cid: CID | undefined
  let resolvedPath: string | undefined
  const errors: Error[] = []

  if (protocol === 'ipfs') {
    try {
      cid = CID.parse(cidOrPeerIdOrDnsLink)
    } catch (err) {
      log.error(err)
      errors.push(new TypeError('Invalid CID for ipfs://<cid> URL'))
    }
  } else {
    let resolveResult = ipnsCache.get(cidOrPeerIdOrDnsLink)

    if (resolveResult != null) {
      cid = resolveResult.cid
      resolvedPath = resolveResult.path
      log.trace('resolved %s to %c from cache', cidOrPeerIdOrDnsLink, cid)
    } else {
      // protocol is ipns
      log.trace('Attempting to resolve PeerId for %s', cidOrPeerIdOrDnsLink)
      let peerId = null

      try {
        peerId = peerIdFromString(cidOrPeerIdOrDnsLink)
        resolveResult = await ipns.resolve(peerId, { onProgress: options?.onProgress })
        cid = resolveResult?.cid
        resolvedPath = resolveResult?.path
        log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
        ipnsCache.set(cidOrPeerIdOrDnsLink, resolveResult, 60 * 1000 * 2)
      } catch (err) {
        if (peerId == null) {
          log.error('Could not parse PeerId string "%s"', cidOrPeerIdOrDnsLink, err)
          errors.push(new TypeError(`Could not parse PeerId in ipns url "${cidOrPeerIdOrDnsLink}", ${(err as Error).message}`))
        } else {
          log.error('Could not resolve PeerId %c', peerId, err)
          errors.push(new TypeError(`Could not resolve PeerId "${cidOrPeerIdOrDnsLink}", ${(err as Error).message}`))
        }
      }

      if (cid == null) {
        log.trace('Attempting to resolve DNSLink for %s', cidOrPeerIdOrDnsLink)

        try {
          resolveResult = await ipns.resolveDns(cidOrPeerIdOrDnsLink, { onProgress: options?.onProgress })
          cid = resolveResult?.cid
          resolvedPath = resolveResult?.path
          log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
          ipnsCache.set(cidOrPeerIdOrDnsLink, resolveResult, 60 * 1000 * 2)
        } catch (err) {
          log.error('Could not resolve DnsLink for "%s"', cidOrPeerIdOrDnsLink, err)
          errors.push(err as Error)
        }
      }
    }
  }

  if (cid == null) {
    throw new AggregateError(errors, `Invalid resource. Cannot determine CID from URL "${urlString}"`)
  }

  // parse query string
  const query: Record<string, any> = {}

  if (queryString != null && queryString.length > 0) {
    const queryParts = queryString.split('&')
    for (const part of queryParts) {
      const [key, value] = part.split('=')
      query[key] = decodeURIComponent(value)
    }

    if (query.download != null) {
      query.download = query.download === 'true'
    }

    if (query.filename != null) {
      query.filename = query.filename.toString()
    }
  }

  /**
   * join the path from resolve result & given path.
   * e.g. /ipns/<peerId>/ that is resolved to /ipfs/<cid>/<path1>, when requested as /ipns/<peerId>/<path2>, should be
   * resolved to /ipfs/<cid>/<path1>/<path2>
   */
  const pathParts = []

  if (urlPath.length > 0) {
    pathParts.push(urlPath)
  }

  if (resolvedPath != null && resolvedPath.length > 0) {
    pathParts.push(resolvedPath)
  }
  const path = pathParts.join('/')

  return {
    protocol,
    cid,
    path,
    query
  }
}
