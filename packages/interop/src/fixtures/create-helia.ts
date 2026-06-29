import { withBitswap } from '@helia/bitswap'
import { withLibp2p, libp2pDefaults } from '@helia/libp2p'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { sha3512 } from '@multiformats/sha3'
import { createHeliaLight } from 'helia'
import * as json from 'multiformats/codecs/json'
import { sha512 } from 'multiformats/hashes/sha2'
import type { HeliaWithLibp2p, DefaultLibp2pServices, CreateLibp2pOptions } from '@helia/libp2p'

export async function createHeliaNode (): Promise<HeliaWithLibp2p<DefaultLibp2pServices>>
export async function createHeliaNode <Services extends Record<string, unknown>> (libp2pOptions: CreateLibp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & DefaultLibp2pServices>>
export async function createHeliaNode (libp2pOptions?: CreateLibp2pOptions<any>): Promise<HeliaWithLibp2p<DefaultLibp2pServices>> {
  const defaults = libp2pDefaults()
  defaults.addresses = {
    listen: [
      '/ip4/0.0.0.0/tcp/0'
    ]
  }
  defaults.services = {
    ...(defaults.services ?? {}),
    ...(libp2pOptions?.services ?? {}),
    dht: kadDHT({
      protocol: '/ipfs/lan/kad/1.0.0',
      peerInfoMapper: removePublicAddressesMapper,
      clientMode: false
    })
  }

  // remove bootstrapper(s), mdns, etc
  defaults.peerDiscovery = []

  // remove services that are not used in tests
  // @ts-expect-error services.autoNAT is not optional
  delete defaults.services.autoNAT
  // @ts-expect-error services.upnp is not optional
  delete defaults.services.upnp
  // @ts-expect-error services.dcutr is not optional
  delete defaults.services.dcutr
  // @ts-expect-error services.delegatedContentRouting is not optional
  delete defaults.services.delegatedContentRouting
  // @ts-expect-error services.delegatedPeerRouting is not optional
  delete defaults.services.delegatedPeerRouting
  // @ts-expect-error services.autoTLS is not optional
  delete defaults.services.autoTLS

  return withBitswap(withLibp2p(createHeliaLight({
    codecs: [
      dagCbor,
      dagJson,
      json
    ],
    hashers: [
      sha512,
      sha3512
    ]
  }), defaults)).start()
}
