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
import { FsBlockstore } from 'blockstore-fs'
import type { Blockstore } from 'interface-blockstore'
import os from 'node:os'
import path from 'node:path'
import { MemoryBlockstore } from 'blockstore-core'
import { LevelDatastore } from 'datastore-level'
import type { Datastore } from 'interface-datastore'
import { MemoryDatastore } from 'datastore-core'
import { IDBDatastore } from 'datastore-idb'
import { IDBBlockstore } from 'blockstore-idb'

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

async function getBlockstore (type?: string): Promise<Blockstore> {
  if (type === 'fs') {
    const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)
    return new FsBlockstore(repoPath)
  }

  if (type === 'idb') {
    const repoPath = `helia-${Math.random()}`
    const store = new IDBBlockstore(repoPath)
    await store.open()

    return store
  }

  return new MemoryBlockstore()
}

async function getDatastore (type?: string): Promise<Datastore> {
  if (type === 'level') {
    const repoPath = path.join(os.tmpdir(), `helia-${Math.random()}`)
    return new LevelDatastore(repoPath)
  }

  if (type === 'idb') {
    const repoPath = `helia-${Math.random()}`
    const db = new IDBDatastore(repoPath)
    await db.open()

    return db
  }

  return new MemoryDatastore()
}

export async function getHelia (): Promise<HeliaLibp2p<Libp2p<any>>> {
  const listen = `${process.env.HELIA_LISTEN ?? ''}`.split(',').filter(Boolean)
  const transports = `${process.env.HELIA_TRANSPORTS ?? ''}`.split(',').filter(Boolean)
  const datastore = await getDatastore(process.env.HELIA_DATASTORE)

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
    },
    datastore
  })

  return await createHelia({
    blockstore: await getBlockstore(process.env.HELIA_BLOCKSTORE),
    datastore,
    blockBrokers: [
      bitswap()
    ],
    routers: [
      libp2pRouting(libp2p)
    ],
    libp2p
  })
}
