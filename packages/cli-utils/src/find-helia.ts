import type { Helia } from '@helia/interface'
import { createHeliaRpcClient } from '@helia/rpc-client'
import { multiaddr } from '@multiformats/multiaddr'
import { createHelia } from './create-helia.js'
import { createLibp2p, Libp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mplex } from '@libp2p/mplex'
import { logger } from '@libp2p/logger'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { FsDatastore } from 'datastore-fs'
import { loadRpcKeychain } from './load-rpc-keychain.js'
import type { PeerId } from '@libp2p/interface-peer-id'

const log = logger('helia:cli:utils:find-helia')

export async function findHelia (configDir: string, rpcAddress: string, user: string, offline: boolean = true, online: boolean = true): Promise<{ helia: Helia, libp2p: Libp2p | undefined }> {
  let {
    libp2p, helia
  } = await findOnlineHelia(configDir, rpcAddress, user)

  if (helia == null) {
    log('connecting to running helia node failed')

    if (!offline) {
      log('could not connect to running helia node and command cannot be run in offline mode')
      throw new Error('Could not connect to Helia - is the node running?')
    }

    log('create offline helia node')
    helia = await createHelia(configDir, offline)
  } else if (!online) {
    log('connected to running helia node but command cannot be run in online mode')
    throw new Error('This command cannot be run while a Helia daemon is running')
  }

  return {
    helia,
    libp2p
  }
}

export async function findOnlineHelia (configDir: string, rpcAddress: string, user: string): Promise<{ helia?: Helia, libp2p?: Libp2p }> {
  const isRunning = await isHeliaRunning(configDir)

  if (!isRunning) {
    log('helia daemon was not running')
    return {}
  }

  let peerId: PeerId | undefined

  try {
    const rpcKeychain = await loadRpcKeychain(configDir)
    peerId = await rpcKeychain.exportPeerId(`rpc-user-${user}`)
  } catch (err) {
    log('could not load peer id rpc-user-%s', user, err)
  }

  log('create dial-only libp2p node')
  const libp2p = await createLibp2p({
    peerId,
    datastore: new FsDatastore(path.join(configDir, 'rpc')),
    transports: [
      tcp()
    ],
    connectionEncryption: [
      noise()
    ],
    streamMuxers: [
      yamux(),
      mplex()
    ],
    relay: {
      enabled: false
    },
    nat: {
      enabled: false
    }
  })

  let helia: Helia | undefined

  try {
    log('create helia client')
    helia = await createHeliaRpcClient({
      multiaddr: multiaddr(`/unix/${rpcAddress}`),
      libp2p,
      user
    })
  } catch (err: any) {
    log('could not create helia rpc client', err)
    await libp2p.stop()

    if (err.name === 'AggregateError' && err.errors != null) {
      throw err.errors[0]
    } else {
      throw err
    }
  }

  return {
    helia,
    libp2p
  }
}

export async function isHeliaRunning (configDir: string): Promise<boolean> {
  const pidFilePath = path.join(configDir, 'helia.pid')

  if (!fs.existsSync(pidFilePath)) {
    log('pidfile at %s did not exist', pidFilePath)
    return false
  }

  const pid = Number(fs.readFileSync(pidFilePath, {
    encoding: 'utf8'
  }).trim())

  if (isNaN(pid)) {
    log('pidfile at %s had invalid contents', pidFilePath)
    log('removing invalid pidfile')
    fs.rmSync(pidFilePath)
    return false
  }

  try {
    // this will throw if the process does not exist
    os.getPriority(pid)
    return true
  } catch (err: any) {
    log('getting process info for pid %d failed', pid)

    if (err.message.includes('no such process') === true) {
      log('process for pid %d was not running', pid)
      log('removing stale pidfile')
      fs.rmSync(pidFilePath)

      return false
    }

    log('error getting process priority for pid %d', pid, err)
    throw err
  }
}
