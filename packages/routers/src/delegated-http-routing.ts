import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { NotFoundError } from '@libp2p/interface'
import { marshalIPNSRecord, multihashFromIPNSRoutingKey, unmarshalIPNSRecord } from 'ipns'
import first from 'it-first'
import map from 'it-map'
import { CID } from 'multiformats/cid'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { delegatedHTTPRoutingDefaults } from './utils/delegated-http-routing-defaults.js'
import type { DelegatedRoutingV1HttpApiClient, DelegatedRoutingV1HttpApiClientInit } from '@helia/delegated-routing-v1-http-api-client'
import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { PeerId, PeerInfo } from '@libp2p/interface'
import type { Version } from 'multiformats'

const IPNS_PREFIX = uint8ArrayFromString('/ipns/')

function isIPNSKey (key: Uint8Array): boolean {
  return uint8ArrayEquals(key.subarray(0, IPNS_PREFIX.byteLength), IPNS_PREFIX)
}

class DelegatedHTTPRouter implements Routing {
  private readonly client: DelegatedRoutingV1HttpApiClient

  constructor (url: URL, init: DelegatedRoutingV1HttpApiClientInit = {}) {
    this.client = createDelegatedRoutingV1HttpApiClient(url, init)
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
        protocols: record.Protocols
      }
    })
  }

  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions): Promise<void> {
    if (!isIPNSKey(key)) {
      return
    }

    const digest = multihashFromIPNSRoutingKey(key)
    const cid = CID.createV1(0x72, digest)
    const record = unmarshalIPNSRecord(value)

    await this.client.putIPNS(cid, record, options)
  }

  async get (key: Uint8Array, options?: RoutingOptions): Promise<Uint8Array> {
    if (!isIPNSKey(key)) {
      throw new NotFoundError('Not found')
    }

    const digest = multihashFromIPNSRoutingKey(key)
    const cid = CID.createV1(0x72, digest)

    try {
      const record = await this.client.getIPNS(cid, options)

      return marshalIPNSRecord(record)
    } catch (err: any) {
      // BadResponseError is thrown when the response had no body, which means
      // the record couldn't be found
      if (err.name === 'BadResponseError') {
        throw new NotFoundError('Not found')
      }

      throw err
    }
  }

  async findPeer (peerId: PeerId, options?: RoutingOptions): Promise<PeerInfo> {
    const peer = await first(this.client.getPeers(peerId, options))

    if (peer != null) {
      return {
        id: peer.ID,
        multiaddrs: peer.Addrs ?? []
      }
    }

    throw new NotFoundError('Not found')
  }

  async * getClosestPeers (key: Uint8Array, options?: RoutingOptions): AsyncIterable<PeerInfo> {
    // noop
  }
}

/**
 * Creates a Helia Router that connects to an endpoint that supports the [Delegated Routing V1 HTTP API](https://specs.ipfs.tech/routing/http-routing-v1/) spec.
 */
export function delegatedHTTPRouting (url: string | URL, init?: DelegatedRoutingV1HttpApiClientInit): Routing {
  const config = init ?? delegatedHTTPRoutingDefaults()
  return new DelegatedHTTPRouter(new URL(url), config)
}
