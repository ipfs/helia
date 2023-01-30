import type { Command } from '@helia/cli-utils'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createEd25519PeerId, createRSAPeerId, createSecp256k1PeerId } from '@libp2p/peer-id-factory'
import { InvalidParametersError } from '@helia/interface/errors'
import type { PeerId } from '@libp2p/interface-peer-id'
import { logger } from '@libp2p/logger'
import { FsDatastore } from 'datastore-fs'
import { randomBytes } from '@libp2p/crypto'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { DefaultKeyChain } from '@libp2p/keychain'
import type { KeyType } from '@libp2p/interface-keychain'
import { loadRpcKeychain } from '@helia/cli-utils/load-rpc-keychain'

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
  rpcKeychainPassword: string
  rpcKeychainSalt: string
  storeRpcPassword: boolean
  rpcUser: string
  rpcUserKeyType: KeyType
}

// NIST SP 800-132
const NIST_MINIMUM_SALT_LENGTH = 128 / 8
const SALT_LENGTH = Math.ceil(NIST_MINIMUM_SALT_LENGTH / 3) * 3 // no base64 padding

export const init: Command<InitArgs> = {
  command: 'init',
  online: false,
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
    },
    rpcKeychainPassword: {
      description: 'The RPC server keychain will use a key derived from this password for encryption operations',
      type: 'string',
      default: uint8ArrayToString(randomBytes(20), 'base64')
    },
    rpcKeychainSalt: {
      description: 'The RPC server keychain will use use this salt when deriving the key from the password',
      type: 'string',
      default: uint8ArrayToString(randomBytes(SALT_LENGTH), 'base64')
    },
    storeRpcPassword: {
      description: 'If true, store the password used to derive the key used by the RPC server keychain in the config file',
      type: 'boolean',
      default: true
    },
    rpcUser: {
      description: 'The default RPC user',
      type: 'string',
      default: process.env.USER
    },
    rpcUserKeyType: {
      description: 'The default RPC user key tupe',
      type: 'string',
      default: 'Ed25519',
      valid: ['RSA', 'Ed25519', 'secp256k1']
    }
  },
  async execute ({ keyType, bits, directory, directoryMode, configFileMode, publicKeyMode, stdout, keychainPassword, keychainSalt, storePassword, rpcKeychainPassword, rpcKeychainSalt, storeRpcPassword, rpcUser, rpcUserKeyType }) {
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
    const rpcDatastorePath = path.join(directory, 'rpc')

    // create a dial-only libp2p node configured with the datastore in the helia
    // directory - this will store the peer id securely in the keychain
    const datastore = new FsDatastore(datastorePath, {
      createIfMissing: true
    })
    await datastore.open()
    const keychain = new DefaultKeyChain({
      datastore
    }, {
      pass: keychainPassword,
      dek: {
        keyLength: 512 / 8,
        iterationCount: 10000,
        hash: 'sha2-512',
        salt: keychainSalt
      }
    })
    await keychain.importPeer('self', peerId)
    await datastore.close()

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
    },
    "bootstrap": [
      "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
      "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
      "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
      "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt"
    ]
  },
  "rpc": {
    "datastore": "${rpcDatastorePath}",
    "keychain": {
      "salt": "${rpcKeychainSalt}"${storeRpcPassword
? `,
      "password": "${rpcKeychainPassword}"`
: ''}
    }
  }
}
`, {
      mode: parseInt(configFileMode, 8),
      flag: 'ax'
    })

    // create an rpc key for the first user
    const rpcKeychain = await loadRpcKeychain(directory)
    await rpcKeychain.createKey(`rpc-user-${rpcUser}`, rpcUserKeyType)

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
