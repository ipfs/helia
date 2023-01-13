import type { Helia } from '@helia/interface'
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

export async function findHelia (configDir: string, rpcAddress: string, offline: boolean = false): Promise<{ helia: Helia, libp2p: Libp2p | undefined }> {
  let {
    libp2p, helia
  } = await findOnlineHelia(configDir, rpcAddress)

  if (helia == null) {
    log('connecting to existing helia node failed')

    // could not connect to running node, start the server
    if (!offline) {
      log('could not create client and command cannot be run in offline mode')
      throw new Error('Could not connect to Helia - is the node running?')
    }

    // return an offline node
    log('create offline helia node')
    helia = await createHelia(configDir, offline)
  }

  return {
    helia,
    libp2p
  }
}

export async function findOnlineHelia (configDir: string, rpcAddress: string): Promise<{ helia?: Helia, libp2p?: Libp2p }> {
  try {
    log('create libp2p node')
    // create a dial-only libp2p node
    const libp2p = await createLibp2p({
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

    let helia: Helia | undefined

    try {
      log('create helia client')
      helia = await createHeliaRpcClient({
        multiaddr: multiaddr(`/unix/${rpcAddress}`),
        libp2p,
        user: `${process.env.USER}`,
        authorization: 'sshh'
      })
    } catch {
      await libp2p.stop()
    }

    return {
      helia,
      libp2p
    }
  } catch (err: any) {
    log('could not create helia client', err)

    if (err.code !== 'ECONNREFUSED' && err.errors[0].code !== 'ECONNREFUSED') {
      throw err
    }
  }

  return {}
}
