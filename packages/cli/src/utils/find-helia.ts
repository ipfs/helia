import type { Helia } from '@helia/interface'
import type { HeliaConfig } from '../index.js'
import { createHeliaRpcClient } from '@helia/rpc-client'
import { multiaddr } from '@multiformats/multiaddr'
import { createHelia } from './create-helia.js'
import { createLibp2p, Libp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { logger } from '@libp2p/logger'

const log = logger('helia:cli:utils:find-helia')

export async function findHelia (config: HeliaConfig, offline: boolean = false): Promise<{ helia: Helia, libp2p: Libp2p | undefined }> {
  let libp2p: Libp2p | undefined
  let helia: Helia | undefined

  try {
    log('create libp2p node')
    // create a dial-only libp2p node
    libp2p = await createLibp2p({
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
      ]
    })

    log('create helia client')
    helia = await createHeliaRpcClient({
      multiaddr: multiaddr(config.grpc.address),
      libp2p,
      authorization: 'sshh'
    })
  } catch (err: any) {
    log('could not create helia client', err)

    if (err.code !== 'ECONNREFUSED' && err.errors[0].code !== 'ECONNREFUSED') {
      throw err
    }
  }

  if (helia == null) {
    log('connecting to existing helia node failed')

    // could not connect to running node, start the server
    if (!offline) {
      log('could not create client and command cannot be run in offline mode')
      throw new Error('Could not connect to Helia - is the node running?')
    }

    // return an offline node
    log('create offline helia node')
    helia = await createHelia(config, offline)
  }

  return {
    helia,
    libp2p
  }
}
