import type { Command, RootArgs } from '@helia/cli-utils'
import fs from 'node:fs'
import { logger } from '@libp2p/logger'
import { findOnlineHelia } from '@helia/cli-utils/find-helia'

const log = logger('helia:cli:commands:status')

export const status: Command<RootArgs> = {
  command: 'status',
  description: 'Report the status of the Helia daemon',
  example: '$ helia status',
  async execute ({ directory, rpcAddress, stdout, user }) {
    // socket file?
    const socketFilePath = rpcAddress

    if (fs.existsSync(socketFilePath)) {
      log(`Found socket file at ${socketFilePath}`)

      const {
        helia, libp2p
      } = await findOnlineHelia(directory, rpcAddress, user)

      if (libp2p != null) {
        await libp2p.stop()
      }

      if (helia == null) {
        log(`Removing stale socket file at ${socketFilePath}`)
        fs.rmSync(socketFilePath)
      } else {
        stdout.write('The daemon is running\n')
        return
      }
    } else {
      log(`Could not find socket file at ${socketFilePath}`)
    }

    stdout.write('The daemon is not running\n')
  }
}
