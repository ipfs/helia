import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { delegatedHTTPRoutingDefaults } from '@helia/delegated-routing-client'
import { delegatedRoutingV1HttpApiClientContentRouting, delegatedRoutingV1HttpApiClientPeerRouting } from '@helia/delegated-routing-v1-http-api-client'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { dcutr } from '@libp2p/dcutr'
import { http } from '@libp2p/http'
import { identify, identifyPush } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { keychain } from '@libp2p/keychain'
import { mplex } from '@libp2p/mplex'
import { ping } from '@libp2p/ping'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { bootstrapConfig } from './bootstrappers.ts'
import type { CreateLibp2pOptions } from '../index.ts'
import type { HTTP } from '@libp2p/http'
import type { Identify, IdentifyPush } from '@libp2p/identify'
import type { ServiceMap } from '@libp2p/interface'
import type { KadDHT } from '@libp2p/kad-dht'
import type { Ping } from '@libp2p/ping'
import type { Libp2pOptions } from 'libp2p'

export interface DefaultLibp2pServices extends Record<string, unknown> {
  autoNAT: unknown
  dcutr: unknown
  delegatedContentRouting: unknown
  delegatedPeerRouting: unknown
  dht: KadDHT
  identify: Identify
  identifyPush: IdentifyPush
  ping: Ping
  http: HTTP
}

export type DefaultLibp2pOptions = Libp2pOptions<DefaultLibp2pServices> & Required<Pick<Libp2pOptions<DefaultLibp2pServices>, 'nodeInfo' | 'addresses' | 'transports' | 'connectionEncrypters' | 'streamMuxers' | 'peerDiscovery' | 'services'>>

export function libp2pDefaults (): DefaultLibp2pOptions
export function libp2pDefaults <M extends ServiceMap, Options extends CreateLibp2pOptions<M>> (options: Options): DefaultLibp2pOptions & Options
export function libp2pDefaults (options?: any): any {
  return {
    ...options,
    addresses: {
      ...options?.addresses,
      listen: [
        '/p2p-circuit',
        '/webrtc',
        ...(options?.addresses?.listen ?? [])
      ]
    },
    transports: [
      circuitRelayTransport(),
      webRTC(),
      webRTCDirect(),
      webSockets(),
      ...(options?.transports ?? [])
    ],
    connectionEncrypters: [
      noise(),
      ...(options?.connectionEncrypters ?? [])
    ],
    streamMuxers: [
      yamux(),
      mplex(),
      ...(options?.streamMuxers ?? [])
    ],
    peerDiscovery: [
      bootstrap(bootstrapConfig),
      ...(options?.peerDiscovery ?? [])
    ],
    services: {
      autoNAT: autoNAT(),
      dcutr: dcutr(),
      delegatedContentRouting: delegatedRoutingV1HttpApiClientContentRouting(delegatedHTTPRoutingDefaults()),
      delegatedPeerRouting: delegatedRoutingV1HttpApiClientPeerRouting(delegatedHTTPRoutingDefaults()),
      dht: kadDHT({
        clientMode: true
      }),
      identify: identify(),
      identifyPush: identifyPush(),
      keychain: keychain(options?.keychain),
      ping: ping(),
      http: http(),
      ...options?.services
    }
  }
}
