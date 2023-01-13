import type { Command } from './index.js'
import { createHelia } from '../utils/create-helia.js'
import { createHeliaRpcServer } from '@helia/rpc-server'
import { EdKeypair } from '@ucans/ucans'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { importKey } from '@libp2p/crypto/keys'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { logger } from '@libp2p/logger'

const log = logger('helia:cli:commands:daemon')

interface DaemonArgs {
  positionals?: string[]
}

export const daemon: Command<DaemonArgs> = {
  command: 'daemon',
  description: 'Starts a Helia daemon',
  example: '$ helia daemon',
  async execute ({ directory, stdout }) {
    const lockfilePath = path.join(directory, 'helia.pid')
    checkPidFile(lockfilePath)

    const helia = await createHelia(directory)

    const keyName = 'rpc-server-key'
    const keyPassword = 'temporary-password'
    let pem: string

    try {
      pem = await helia.libp2p.keychain.exportKey(keyName, keyPassword)
      log('loaded rpc server key from libp2p keystore')
    } catch (err: any) {
      if (err.code !== 'ERR_NOT_FOUND') {
        throw err
      }

      log('creating rpc server key and storing in libp2p keystore')
      await helia.libp2p.keychain.createKey(keyName, 'Ed25519')
      pem = await helia.libp2p.keychain.exportKey(keyName, keyPassword)
    }

    log('reading rpc server key as peer id')
    const privateKey = await importKey(pem, keyPassword)
    const peerId = await peerIdFromKeys(privateKey.public.bytes, privateKey.bytes)

    if (peerId.privateKey == null || peerId.publicKey == null) {
      throw new Error('Private key missing')
    }

    const key = new EdKeypair(
      peerId.privateKey.subarray(4),
      peerId.publicKey.subarray(4),
      false
    )

    await createHeliaRpcServer({
      helia,
      serverDid: key.did()
    })

    const id = await helia.id()

    stdout.write(`${id.agentVersion} is running\n`)

    id.multiaddrs.forEach(ma => {
      stdout.write(`${ma.toString()}\n`)
    })

    fs.writeFileSync(lockfilePath, process.pid.toString())
  }
}

/**
 * Check the passed lockfile path exists, if it does it should contain the PID
 * of the owning process. Read the file, check if the process with the PID is
 * still running, throw an error if it is.
 *
 * @param pidFilePath
 */
function checkPidFile (pidFilePath: string): void {
  if (!fs.existsSync(pidFilePath)) {
    return
  }

  const pid = Number(fs.readFileSync(pidFilePath, {
    encoding: 'utf8'
  }).trim())

  try {
    // this will throw if the process does not exist
    os.getPriority(pid)

    throw new Error(`Helia already running with pid ${pid}`)
  } catch (err: any) {
    if (err.message.includes('no such process') === true) {
      log('Removing stale pidfile')
      fs.rmSync(pidFilePath)
    } else {
      throw err
    }
  }
}
