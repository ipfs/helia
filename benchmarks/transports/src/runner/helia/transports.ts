import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { tcp } from '@libp2p/tcp'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import type { Transport } from '@libp2p/interface'

interface TransportFactory { (...args: any[]): Transport }

export function getTransports (): TransportFactory[] {
  return [
    tcp(),
    webSockets(),
    webRTC(),
    circuitRelayTransport()
  ]
}
