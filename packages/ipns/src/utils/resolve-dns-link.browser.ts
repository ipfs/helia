/* eslint-env browser */

import PQueue from 'p-queue'
import { TLRU } from './tlru.js'
import type { AbortOptions } from '@libp2p/interfaces'

// Avoid sending multiple queries for the same hostname by caching results
const cache = new TLRU<{ Path: string, Message: string }>(1000)
// TODO: /api/v0/dns does not return TTL yet: https://github.com/ipfs/go-ipfs/issues/5884
// However we know browsers themselves cache DNS records for at least 1 minute,
// which acts a provisional default ttl: https://stackoverflow.com/a/36917902/11518426
const ttl = 60 * 1000

// browsers limit concurrent connections per host,
// we don't want preload calls to exhaust the limit (~6)
const httpQueue = new PQueue({ concurrency: 4 })

const ipfsPath = (response: { Path: string, Message: string }): string => {
  if (response.Path != null) {
    return response.Path
  }
  throw new Error(response.Message)
}

export interface ResolveDnsLinkOptions extends AbortOptions {
  nocache?: boolean
}

export async function resolveDnslink (fqdn: string, opts: ResolveDnsLinkOptions = {}): Promise<string> { // eslint-disable-line require-await
  const resolve = async (fqdn: string, opts: ResolveDnsLinkOptions = {}): Promise<string> => {
    // @ts-expect-error - URLSearchParams does not take boolean options, only strings
    const searchParams = new URLSearchParams(opts)
    searchParams.set('arg', fqdn)

    // try cache first
    const query = searchParams.toString()
    if (opts.nocache !== true && cache.has(query)) {
      const response = cache.get(query)

      if (response != null) {
        return ipfsPath(response)
      }
    }

    // fallback to delegated DNS resolver
    const response = await httpQueue.add(async () => {
      // Delegated HTTP resolver sending DNSLink queries to ipfs.io
      // TODO: replace hardcoded host with configurable DNS over HTTPS: https://github.com/ipfs/js-ipfs/issues/2212
      const res = await fetch(`https://ipfs.io/api/v0/dns?${searchParams}`)
      const query = new URL(res.url).search.slice(1)
      const json = await res.json()
      cache.set(query, json, ttl)

      return json
    })

    return ipfsPath(response)
  }

  return resolve(fqdn, opts)
}
