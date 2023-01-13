import type { Command } from './index.js'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createEd25519PeerId, createRSAPeerId, createSecp256k1PeerId } from '@libp2p/peer-id-factory'
import { InvalidParametersError } from '@helia/interface/errors'
import type { PeerId } from '@libp2p/interface-peer-id'
import { logger } from '@libp2p/logger'

const log = logger('helia:cli:commands:init')

interface InitArgs {
  positionals?: string[]
  keyType: string
  bits: string
  port: string
  directory: string
  directoryMode: string
  configFileMode: string
  publicKeyMode: string
  privateKeyMode: string
}

export const init: Command<InitArgs> = {
  command: 'init',
  offline: true,
  description: 'Initialize the node',
  example: '$ helia init',
  options: {
    keyType: {
      description: 'The key type, valid options are "ed25519", "secp256k1" or "rsa"',
      type: 'string',
      short: 'k',
      default: 'ed25519'
    },
    bits: {
      description: 'Key length (only applies to RSA keys)',
      type: 'string',
      short: 'b',
      default: '2048'
    },
    port: {
      description: 'Where to listen for incoming gRPC connections',
      type: 'string',
      short: 'p',
      default: '49832'
    },
    directory: {
      description: 'The directory to store config in',
      type: 'string',
      short: 'd',
      default: path.join(os.homedir(), '.helia')
    },
    directoryMode: {
      description: 'If the config file directory does not exist, create it with this mode',
      type: 'string',
      default: '0700'
    },
    configFileMode: {
      description: 'If the config file does not exist, create it with this mode',
      type: 'string',
      default: '0600'
    },
    privateKeyMode: {
      description: 'If the config file does not exist, create it with this mode',
      type: 'string',
      default: '0600'
    },
    publicKeyMode: {
      description: 'If the config file does not exist, create it with this mode',
      type: 'string',
      default: '0644'
    }
  },
  async execute ({ keyType, bits, directory, directoryMode, configFileMode, privateKeyMode, publicKeyMode, port, stdout }) {
    try {
      await fs.readdir(directory)
      // don't init if we are already inited
      throw new InvalidParametersError(`Cowardly refusing to reinitialize Helia at ${directory}`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    const configFile = path.join(directory, 'config.json')
    const peerId = await generateKey(keyType, bits)

    if (peerId.publicKey == null || peerId.privateKey == null) {
      throw new InvalidParametersError('Generated PeerId had missing components')
    }

    log('create helia dir %s', directory)
    await fs.mkdir(directory, {
      recursive: true,
      mode: parseInt(directoryMode, 8)
    })

    const publicKeyPath = path.join(directory, 'peer.pub')
    log('create public key %s', publicKeyPath)
    await fs.writeFile(publicKeyPath, peerId.publicKey, {
      mode: parseInt(publicKeyMode, 8),
      flag: 'ax'
    })

    const privateKeyPath = path.join(directory, 'peer.key')
    log('create private key %s', privateKeyPath)
    await fs.writeFile(privateKeyPath, peerId.privateKey, {
      mode: parseInt(privateKeyMode, 8),
      flag: 'ax'
    })

    const configFilePath = path.join(directory, 'config.json')
    log('create config file %s', configFilePath)
    await fs.writeFile(configFilePath, `
{
  // Where blocks are stored
  "blockstore": "${path.join(directory, 'blocks')}",

  // Where data is stored
  "datastore": "${path.join(directory, 'data')}",

  // libp2p configuration
  "libp2p": {
    "addresses": {
      "listen": [
        "/ip4/0.0.0.0/tcp/0",
        "/ip4/0.0.0.0/tcp/0/ws",
        "/unix${directory}/rpc.sock"
      ]
    }
  }
}
`, {
      mode: parseInt(configFileMode, 8),
      flag: 'ax'
    })

    stdout.write(`Wrote config file to ${configFile}\n`)
  }
}

async function generateKey (type: string, bits: string = '2048'): Promise<PeerId> {
  if (type === 'ed25519') {
    return await createEd25519PeerId()
  } else if (type === 'secp256k1') {
    return await createSecp256k1PeerId()
  } else if (type === 'rsa') {
    return await createRSAPeerId({
      bits: parseInt(bits)
    })
  }

  throw new InvalidParametersError(`Unknown key type "${type}" - must be "ed25519", "secp256k1" or "rsa"`)
}
