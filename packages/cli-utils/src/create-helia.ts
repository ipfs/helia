import type { Helia } from '@helia/interface'
import type { HeliaConfig } from './index.js'
import { createHelia as createHeliaNode } from 'helia'
import { FsDatastore } from 'datastore-fs'
import { BlockstoreDatastoreAdapter } from 'blockstore-datastore-adapter'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { prometheusMetrics } from '@libp2p/prometheus-metrics'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { kadDHT } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import stripJsonComments from 'strip-json-comments'
import fs from 'node:fs'
import path from 'node:path'
import * as readline from 'node:readline/promises'
import { ShardingDatastore } from 'datastore-core'
import { NextToLast } from 'datastore-core/shard'

export async function createHelia (configDir: string, offline: boolean = false): Promise<Helia> {
  const config: HeliaConfig = JSON.parse(stripJsonComments(fs.readFileSync(path.join(configDir, 'helia.json'), 'utf-8')))
  let password = config.libp2p.keychain.password

  if (config.libp2p.keychain.password == null) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    password = await rl.question('Enter libp2p keychain password: ')
  }

  const datastore = new FsDatastore(config.datastore, {
    createIfMissing: true
  })
  await datastore.open()

  const blockstore = new BlockstoreDatastoreAdapter(
    new ShardingDatastore(
      new FsDatastore(config.blockstore),
      new NextToLast(2)
    )
  )
  await blockstore.open()

  const helia = await createHeliaNode({
    blockstore,
    datastore,
    libp2p: await createLibp2p({
      start: !offline,
      datastore,
      addresses: config.libp2p.addresses,
      identify: {
        host: {
          agentVersion: 'helia/0.0.0'
        }
      },
      keychain: {
        pass: password,
        dek: {
          salt: config.libp2p.keychain.salt
        }
      },
      transports: [
        tcp(),
        webSockets()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        yamux(),
        mplex()
      ],
      peerDiscovery: [
        bootstrap({
          list: config.libp2p.bootstrap
        })
      ],
      pubsub: gossipsub(),
      dht: kadDHT(),
      metrics: prometheusMetrics()
    })
  })

  return helia
}
