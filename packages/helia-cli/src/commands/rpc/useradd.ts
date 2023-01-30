import type { Command } from '@helia/cli-utils'
import type { KeyType } from '@libp2p/interface-keychain'
import { loadRpcKeychain } from '@helia/cli-utils/load-rpc-keychain'

interface AddRpcUserArgs {
  positionals: string[]
  keyType: KeyType
}

export const rpcUseradd: Command<AddRpcUserArgs> = {
  command: 'useradd',
  description: 'Add an RPC user to your Helia node',
  example: '$ helia rpc useradd <username>',
  options: {
    keyType: {
      description: 'The type of key',
      type: 'string',
      default: 'Ed25519',
      valid: ['Ed25519', 'secp256k1']
    }
  },
  async execute ({ directory, positionals, keyType, stdout }) {
    const user = positionals[0] ?? process.env.USER

    if (user == null) {
      throw new Error('No user specified')
    }

    const keychain = await loadRpcKeychain(directory)
    const keyName = `rpc-user-${user}`
    const keys = await keychain.listKeys()

    if (keys.some(info => info.name === keyName)) {
      throw new Error(`User "${user}" already exists`)
    }

    await keychain.createKey(`rpc-user-${user}`, keyType)

    stdout.write(`Created user ${user}\n`)
  }
}
