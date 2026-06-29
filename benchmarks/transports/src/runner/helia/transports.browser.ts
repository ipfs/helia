import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import type { Transport } from '@libp2p/interface'

interface TransportFactory { (...args: any[]): Transport }

export function getTransports (): TransportFactory[] {
  return [
    webSockets(),
    webRTC(),
    circuitRelayTransport(),
    webTransport()
  ]
}
