import type { Command } from './index.js'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createEd25519PeerId, createRSAPeerId, createSecp256k1PeerId } from '@libp2p/peer-id-factory'
import { InvalidParametersError } from '@helia/interface/errors'
import type { PeerId } from '@libp2p/interface-peer-id'
import { logger } from '@libp2p/logger'
import { createLibp2p } from 'libp2p'
import { FsDatastore } from 'datastore-fs'
import { noise } from '@chainsafe/libp2p-noise'
import { tcp } from '@libp2p/tcp'
import { yamux } from '@chainsafe/libp2p-yamux'
import { findHeliaDir } from '../utils/find-helia-dir.js'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

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
  keychainPassword: string
  keychainSalt: string
  storePassword: boolean
}

// NIST SP 800-132
const NIST_MINIMUM_SALT_LENGTH = 128 / 8
const SALT_LENGTH = Math.ceil(NIST_MINIMUM_SALT_LENGTH / 3) * 3 // no base64 padding

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
    directory: {
      description: 'The directory to store data in',
      type: 'string',
      short: 'd',
      default: findHeliaDir()
    },
    directoryMode: {
      description: 'Create the data directory with this mode',
      type: 'string',
      default: '0700'
    },
    configFileMode: {
      description: 'Create the config file with this mode',
      type: 'string',
      default: '0600'
    },
    publicKeyMode: {
      description: 'Create the public key file with this mode',
      type: 'string',
      default: '0644'
    },
    keychainPassword: {
      description: 'The libp2p keychain will use a key derived from this password for encryption operations',
      type: 'string',
      default: uint8ArrayToString(randomBytes(20), 'base64')
    },
    keychainSalt: {
      description: 'The libp2p keychain will use use this salt when deriving the key from the password',
      type: 'string',
      default: uint8ArrayToString(randomBytes(SALT_LENGTH), 'base64')
    },
    storePassword: {
      description: 'If true, store the password used to derive the key used by the libp2p keychain in the config file',
      type: 'boolean',
      default: true
    }
  },
  async execute ({ keyType, bits, directory, directoryMode, configFileMode, publicKeyMode, stdout, keychainPassword, keychainSalt, storePassword }) {
    try {
      await fs.readdir(directory)
      // don't init if we are already inited
      throw new InvalidParametersError(`Cowardly refusing to reinitialize Helia at ${directory}`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    const configFilePath = path.join(directory, 'helia.json')

    try {
      await fs.access(configFilePath)
      // don't init if we are already inited
      throw new InvalidParametersError(`Cowardly refusing to overwrite Helia config file at ${configFilePath}`)
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }

    const peerId = await generateKey(keyType, bits)

    if (peerId.publicKey == null || peerId.privateKey == null) {
      throw new InvalidParametersError('Generated PeerId had missing components')
    }

    log('create helia dir %s', directory)
    await fs.mkdir(directory, {
      recursive: true,
      mode: parseInt(directoryMode, 8)
    })

    const datastorePath = path.join(directory, 'data')

    // create a dial-only libp2p node configured with the datastore in the helia
    // directory - this will store the peer id securely in the keychain
    const node = await createLibp2p({
      peerId,
      datastore: new FsDatastore(datastorePath, {
        createIfMissing: true
      }),
      transports: [
        tcp()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        yamux()
      ],
      keychain: {
        pass: keychainPassword,
        dek: {
          salt: keychainSalt
        }
      }
    })
    await node.stop()

    // now write the public key from the PeerId out for use by the RPC client
    const publicKeyPath = path.join(directory, 'peer.pub')
    log('create public key %s', publicKeyPath)
    await fs.writeFile(publicKeyPath, peerId.toString() + '\n', {
      mode: parseInt(publicKeyMode, 8),
      flag: 'ax'
    })

    log('create config file %s', configFilePath)
    await fs.writeFile(configFilePath, `
{
  // Where blocks are stored
  "blockstore": "${path.join(directory, 'blocks')}",

  // Where data is stored
  "datastore": "${datastorePath}",

  // libp2p configuration
  "libp2p": {
    "addresses": {
      "listen": [
        "/ip4/0.0.0.0/tcp/0",
        "/ip4/0.0.0.0/tcp/0/ws",

        // this is the rpc socket
        "/unix${directory}/rpc.sock"
      ],
      "noAnnounce": [
        // do not announce the rpc socket to the outside world
        "/unix${directory}/rpc.sock"
      ]
    },
    "keychain": {
      "salt": "${keychainSalt}"${storePassword
? `,
      "password": "${keychainPassword}"`
: ''}
    }
  }
}
`, {
      mode: parseInt(configFileMode, 8),
      flag: 'ax'
    })

    stdout.write(`Wrote config file to ${configFilePath}\n`)
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
