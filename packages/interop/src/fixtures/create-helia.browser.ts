import { withBitswap } from '@helia/bitswap'
import { libp2pDefaults, withLibp2pLight } from '@helia/libp2p'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagJson from '@ipld/dag-json'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT, removePublicAddressesMapper } from '@libp2p/kad-dht'
import { keychain } from '@libp2p/keychain'
import { ping } from '@libp2p/ping'
import { sha3512 } from '@multiformats/sha3'
import { createHeliaLight } from 'helia'
import * as json from 'multiformats/codecs/json'
import { sha512 } from 'multiformats/hashes/sha2'
import type { Libp2pTestServices } from './create-helia.ts'
import type { HeliaWithLibp2p } from '@helia/libp2p'
import type { ServiceMap } from '@libp2p/interface'
import type { Libp2pOptions } from 'libp2p'

export async function createHeliaNode (): Promise<HeliaWithLibp2p<Libp2pTestServices>>
export async function createHeliaNode <Services extends ServiceMap> (libp2pOptions: Libp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & Libp2pTestServices>>
export async function createHeliaNode <Services extends ServiceMap> (libp2pOptions?: Libp2pOptions<Services>): Promise<HeliaWithLibp2p<Services & Libp2pTestServices>> {
  const defaults = libp2pDefaults()

  const config: Libp2pOptions<any> = {
    addresses: {
      listen: [
        '/p2p-circuit',
        '/webrtc'
      ]
    },
    transports: defaults.transports,
    connectionEncrypters: defaults.connectionEncrypters,
    streamMuxers: defaults.streamMuxers,
    // remove bootstrapper(s)
    peerDiscovery: [],
    // allow dialing loopback
    connectionGater: {
      denyDialMultiaddr: () => false
    },
    services: {
      // use LAN DHT
      dht: kadDHT({
        protocol: '/ipfs/lan/kad/1.0.0',
        peerInfoMapper: removePublicAddressesMapper,
        clientMode: false
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      keychain: keychain(),
      ping: ping(),
      ...libp2pOptions?.services
    },
    ...libp2pOptions
  }

  return withBitswap(withLibp2pLight(createHeliaLight({
    codecs: [
      dagCbor,
      dagJson,
      json
    ],
    hashers: [
      sha512,
      sha3512
    ]
  }), config)).start()
}
