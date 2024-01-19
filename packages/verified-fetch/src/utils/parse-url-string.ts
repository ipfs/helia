import { type IPNS } from '@helia/ipns'
import { logger } from '@libp2p/logger'
import { peerIdFromString } from '@libp2p/peer-id'
import { CID } from 'multiformats/cid'

const log = logger('helia:verified-fetch:parse-url-string')

export interface ParsedUrlStringResults {
  protocol: string
  path: string
  cid: CID
}

export interface ParseUrlStringOptions {
  urlString: string
  ipns: IPNS
}

const URL_REGEX = /^(?<protocol>ip[fn]s):\/\/(?<cidOrPeerIdOrDnsLink>[^/$]+)\/?(?<path>[^$^?]*)/

/**
 * A function that parses ipfs:// and ipns:// URLs, returning an object with easily recognizable properties.
 */
export async function parseUrlString ({ urlString, ipns }: ParseUrlStringOptions): Promise<ParsedUrlStringResults> {
  const match = urlString.match(URL_REGEX)
  if (match == null || match.groups == null) {
    throw new TypeError(`Invalid URL: ${urlString}`)
  }
  const { protocol, cidOrPeerIdOrDnsLink, path } = match.groups

  let cid: CID | null = null
  if (protocol === 'ipfs') {
    try {
      cid = CID.parse(cidOrPeerIdOrDnsLink)
    } catch (err) {
      log.error(err)
      throw new TypeError('Invalid CID for ipfs://<cid> URL')
    }
  } else if (protocol === 'ipns') {
    if (cidOrPeerIdOrDnsLink.includes('.')) {
      try {
        cid = await ipns.resolveDns(cidOrPeerIdOrDnsLink)
      } catch (err) {
        log.error(err)
        throw new TypeError('Invalid DNSLink for ipns://<dnslink> URL')
      }
    }

    try {
      const peerId = peerIdFromString(cidOrPeerIdOrDnsLink)
      cid = await ipns.resolve(peerId)
    } catch (err) {
      log.error(err)
      // ignore non PeerId
    }
  } else {
    throw new TypeError('Invalid protocol for URL. Please use ipfs:// or ipns:// URLs only.')
  }

  if (cid == null) {
    throw new TypeError(`Invalid resource. Cannot determine CID from URL: ${urlString}`)
  }

  return {
    protocol,
    cid,
    path
  }
}
