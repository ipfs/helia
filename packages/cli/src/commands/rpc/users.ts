import type { Command } from '../index.js'
import { loadRpcKeychain } from './utils.js'

export const rpcUsers: Command = {
  command: 'users',
  description: 'List user accounts on the Helia RPC server',
  example: '$ helia rpc users',
  async execute ({ directory, stdout }) {
    const keychain = await loadRpcKeychain(directory)
    const keys = await keychain.listKeys()

    for (const info of keys) {
      if (info.name.startsWith('rpc-user-')) {
        stdout.write(`${info.name.substring('rpc-user-'.length)}\n`)
      }
    }
  }
}
