import { type IPNS } from '@helia/ipns'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'
import type { ParsedUrlStringResults } from '../interface.js'

const log = logger('helia:verified-fetch:parse-url-string')

export interface ParseUrlStringOptions {
  urlString: string
  ipns: IPNS
}

const URL_REGEX = /^(?<protocol>ip[fn]s):\/\/(?<cidOrPeerIdOrDnsLink>[^/$?]+)\/?(?<path>[^$?]*)\??(?<queryString>.*)$/

/**
 * A function that parses ipfs:// and ipns:// URLs, returning an object with easily recognizable properties.
 */
export async function parseUrlString ({ urlString, ipns }: ParseUrlStringOptions): Promise<ParsedUrlStringResults> {
  const match = urlString.match(URL_REGEX)
  if (match == null || match.groups == null) {
    throw new TypeError(`Invalid URL: ${urlString}, please use ipfs:// or ipns:// URLs only.`)
  }
  const { protocol, cidOrPeerIdOrDnsLink, path, queryString } = match.groups

  let cid: CID | null = null
  if (protocol === 'ipfs') {
    try {
      cid = CID.parse(cidOrPeerIdOrDnsLink)
    } catch (err) {
      log.error(err)
      throw new TypeError('Invalid CID for ipfs://<cid> URL')
    }
  } else {
    // protocol is ipns
    if (cidOrPeerIdOrDnsLink.includes('.')) {
      log.trace('Attempting to resolve DNSLink for %s', cidOrPeerIdOrDnsLink)
      try {
        cid = await ipns.resolveDns(cidOrPeerIdOrDnsLink)
        log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
      } catch (err) {
        log.error(err)
        throw err
      }
    } else {
      log.trace('Attempting to resolve PeerId for %s', cidOrPeerIdOrDnsLink)
      let peerId = null
      try {
        peerId = peerIdFromString(cidOrPeerIdOrDnsLink)
        cid = await ipns.resolve(peerId)
        log.trace('resolved %s to %c', cidOrPeerIdOrDnsLink, cid)
      } catch (err) {
        if (peerId == null) {
          log.error('Could not parse PeerId string "%s"', cidOrPeerIdOrDnsLink, err)
          throw new TypeError(`Invalid resource. Cannot determine CID from URL "${urlString}", ${(err as Error).message}`)
        }
        log.error('Could not resolve PeerId %c', peerId, err)
        throw new TypeError(`Could not resolve PeerId "${cidOrPeerIdOrDnsLink}", ${(err as Error).message}`)
      }
    }
  }

  if (cid == null) {
    throw new TypeError(`Invalid resource. Cannot determine CID from URL: ${urlString}`)
  }

  // parse query string
  const query: Record<string, string> = {}
  if (queryString != null && queryString.length > 0) {
    const queryParts = queryString.split('&')
    for (const part of queryParts) {
      const [key, value] = part.split('=')
      query[key] = decodeURIComponent(value)
    }
  }

  return {
    protocol,
    cid,
    path,
    query
  }
}
