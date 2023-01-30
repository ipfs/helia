import type { Command } from '@helia/cli-utils'
import { rpcRmuser } from './rmuser.js'
import { rpcUseradd } from './useradd.js'
import { rpcUsers } from './users.js'

export const rpc: Command = {
  command: 'rpc',
  description: 'Update the config of the Helia RPC server',
  example: '$ helia rpc',
  subcommands: [
    rpcRmuser,
    rpcUseradd,
    rpcUsers
  ],
  async execute ({ stdout }) {
    stdout.write('Please enter a subcommand\n')
  }
}
