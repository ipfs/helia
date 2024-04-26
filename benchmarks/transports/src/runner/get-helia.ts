import { createHelia, type HeliaLibp2p } from 'helia'
import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import * as wsFilters from '@libp2p/websockets/filters'
import { tcp } from '@libp2p/tcp'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import type { Libp2p, Transport } from '@libp2p/interface'
import { bitswap } from '@helia/block-brokers'
import { libp2pRouting } from '@helia/routers'

type TransportFactory = (...args: any[]) => Transport

async function getTransports (names: string[]): Promise<TransportFactory[]> {
  const output: TransportFactory[] = []

  if (names.includes('tcp')) {
    output.push(tcp())
  }

  if (names.includes('ws')) {
    output.push(webSockets({
      filter: wsFilters.all
    }))
  }

  if (names.includes('webRTC')) {
    output.push(webRTC())
  }

  if (names.includes('circuitRelay')) {
    output.push(circuitRelayTransport())
  }

  return output
}

export async function getHelia (): Promise<HeliaLibp2p<Libp2p<any>>> {
  const listen = `${process.env.HELIA_LISTEN ?? ''}`.split(',').filter(Boolean)
  const transports = `${process.env.HELIA_TRANSPORTS ?? ''}`.split(',').filter(Boolean)

  const libp2p = await createLibp2p({
    addresses: {
      listen
    },
    transports: await getTransports(transports),
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services: {
      identify: identify()
    },
    connectionManager: {
      minConnections: 0
    },
    connectionGater: {
      denyDialMultiaddr: async () => false
    }
  })

  return await createHelia({
    blockBrokers: [
      bitswap()
    ],
    routers: [
      libp2pRouting(libp2p)
    ],
    libp2p
  })
}
