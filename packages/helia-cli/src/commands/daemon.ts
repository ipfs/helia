import type { Command } from '@helia/cli-utils'
import { createHelia } from '@helia/cli-utils/create-helia'
import { createHeliaRpcServer } from '@helia/rpc-server'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { logger } from '@libp2p/logger'
import { loadRpcKeychain } from '@helia/cli-utils/load-rpc-keychain'

const log = logger('helia:cli:commands:daemon')

interface DaemonArgs {
  positionals?: string[]
  authorizationValiditySeconds: number
}

export const daemon: Command<DaemonArgs> = {
  command: 'daemon',
  description: 'Starts a Helia daemon',
  example: '$ helia daemon',
  online: false,
  options: {
    authorizationValiditySeconds: {
      description: 'How many seconds a request authorization token is valid for',
      type: 'string',
      default: '5'
    }
  },
  async execute ({ directory, stdout, authorizationValiditySeconds }) {
    const lockfilePath = path.join(directory, 'helia.pid')
    checkPidFile(lockfilePath)

    const rpcSocketFilePath = path.join(directory, 'rpc.sock')
    checkRpcSocketFile(rpcSocketFilePath)

    const helia = await createHelia(directory)

    await createHeliaRpcServer({
      helia,
      users: await loadRpcKeychain(directory),
      authorizationValiditySeconds: Number(authorizationValiditySeconds)
    })

    const info = await helia.info()

    stdout.write(`${info.agentVersion} is running\n`)

    if (info.multiaddrs.length > 0) {
      stdout.write('Listening on:\n')

      info.multiaddrs.forEach(ma => {
        stdout.write(`  ${ma.toString()}\n`)
      })
    }

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

function checkRpcSocketFile (rpcSocketFilePath: string): void {
  if (fs.existsSync(rpcSocketFilePath)) {
    log('Removing stale rpc socket file')
    fs.rmSync(rpcSocketFilePath)
  }
}
