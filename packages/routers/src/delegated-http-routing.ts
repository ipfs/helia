import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import { CodeError } from '@libp2p/interface'
import { marshal, unmarshal, peerIdFromRoutingKey } from 'ipns'
import first from 'it-first'
import map from 'it-map'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import type { DelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import type { Provider, Routing, RoutingOptions } from '@helia/interface'
import type { PeerId, PeerInfo } from '@libp2p/interface'
import type { CID, Version } from 'multiformats'

const IPNS_PREFIX = uint8ArrayFromString('/ipns/')

function isIPNSKey (key: Uint8Array): boolean {
  return uint8ArrayEquals(key.subarray(0, IPNS_PREFIX.byteLength), IPNS_PREFIX)
}

class DelegatedHTTPRouter implements Routing {
  private readonly client: DelegatedRoutingV1HttpApiClient

  constructor (url: URL) {
    this.client = createDelegatedRoutingV1HttpApiClient(url)
  }

  async provide (cid: CID, options?: RoutingOptions | undefined): Promise<void> {
    // noop
  }

  async * findProviders (cid: CID<unknown, number, number, Version>, options?: RoutingOptions | undefined): AsyncIterable<Provider> {
    yield * map(this.client.getProviders(cid, options), (record) => {
      return {
        id: record.ID,
        multiaddrs: record.Addrs,
        protocols: record.Protocols
      }
    })
  }

  async put (key: Uint8Array, value: Uint8Array, options?: RoutingOptions | undefined): Promise<void> {
    if (!isIPNSKey(key)) {
      return
    }

    const peerId = peerIdFromRoutingKey(key)
    const record = unmarshal(value)

    await this.client.putIPNS(peerId, record, options)
  }

  async get (key: Uint8Array, options?: RoutingOptions | undefined): Promise<Uint8Array> {
    if (!isIPNSKey(key)) {
      throw new CodeError('Not found', 'ERR_NOT_FOUND')
    }

    const peerId = peerIdFromRoutingKey(key)

    try {
      const record = await this.client.getIPNS(peerId, options)

      return marshal(record)
    } catch (err: any) {
      // ERR_BAD_RESPONSE is thrown when the response had no body, which means
      // the record couldn't be found
      if (err.code === 'ERR_BAD_RESPONSE') {
        throw new CodeError('Not found', 'ERR_NOT_FOUND')
      }

      throw err
    }
  }

  async findPeer (peerId: PeerId, options?: RoutingOptions | undefined): Promise<PeerInfo> {
    const peer = await first(this.client.getPeers(peerId, options))

    if (peer != null) {
      return {
        id: peer.ID,
        multiaddrs: peer.Addrs ?? []
      }
    }

    throw new CodeError('Not found', 'ERR_NOT_FOUND')
  }

  async * getClosestPeers (key: Uint8Array, options?: RoutingOptions | undefined): AsyncIterable<PeerInfo> {
    // noop
  }
}

/**
 * Creates a Helia Router that connects to an endpoint that supports the [Delegated Routing V1 HTTP API](https://specs.ipfs.tech/routing/http-routing-v1/) spec.
 */
export function delegatedHTTPRouting (url: string | URL): Routing {
  return new DelegatedHTTPRouter(new URL(url))
}
