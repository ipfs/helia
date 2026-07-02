import { delegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { NotFoundError } from '@libp2p/interface'
import first from 'it-first'
import map from 'it-map'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { DelegatedRoutingV1HttpApiClient, DelegatedRoutingV1HttpApiClientComponents, DelegatedRoutingV1HttpApiClientInit } from '@helia/delegated-routing-v1-http-api-client'
import type { Peer, Provider, Router, RoutingOptions } from '@helia/interface'
import type { Version } from 'multiformats'

const IPNS_PREFIX = uint8ArrayFromString('/ipns/')

function isIPNSKey (key: Uint8Array): boolean {
  return uint8ArrayEquals(key.subarray(0, IPNS_PREFIX.byteLength), IPNS_PREFIX)
}

export class DelegatedHTTPRouter implements Router {
  public readonly name = 'delegated-http-router'
  private readonly client: DelegatedRoutingV1HttpApiClient

  constructor (components: DelegatedRoutingV1HttpApiClientComponents, init: DelegatedRoutingV1HttpApiClientInit) {
    this.client = delegatedRoutingV1HttpApiClient(init)(components)
  }

  async provide (cid: CID, options?: RoutingOptions): Promise<void> {
    // noop
  }

  async cancelReprovide (cid?: CID, options?: RoutingOptions): Promise<void> {
    // noop
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions): AsyncIterable<Provider> {
    yield * map(this.client.getProviders(cid, options), (record) => {
      return {
        id: record.ID,
        multiaddrs: record.Addrs,
        protocols: record.Protocols,
        routing: 'delegated-http-routing'
      }
    })
  }

  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void> {
    if (!isIPNSKey(key)) {
      return
    }

    const digest = Digest.decode(key.slice(IPNS_PREFIX.length))
    const cid = CID.createV1(0x72, digest)

    await this.client.putIPNS(cid, value, options)
  }

  async get (key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array<ArrayBuffer>> {
    if (!isIPNSKey(key)) {
      throw new NotFoundError('Not found')
    }

    const digest = Digest.decode(key.slice(IPNS_PREFIX.length))
    const cid = CID.createV1(0x72, digest)

    try {
      return await this.client.getIPNS(cid, options)
    } catch (err: any) {
      // BadResponseError is thrown when the response had no body, which means
      // the record couldn't be found
      if (err.name === 'BadResponseError') {
        throw new NotFoundError('Not found')
      }

      throw err
    }
  }

  async findPeer (peerId: CID, options?: RoutingOptions): Promise<Peer> {
    const peer = await first(this.client.getPeers(peerId, options))

    if (peer != null) {
      return {
        id: peer.ID,
        multiaddrs: peer.Addrs ?? []
      }
    }

    throw new NotFoundError('Not found')
  }

  async * getClosestPeers (key: Uint8Array, options?: RoutingOptions): AsyncIterable<Peer> {
    // noop
  }

  toString (): string {
    return `DelegatedHTTPRouter(${this.client.url})`
  }
}
