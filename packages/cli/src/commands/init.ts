import type { Command } from './index.js'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createEd25519PeerId, createRSAPeerId, createSecp256k1PeerId } from '@libp2p/peer-id-factory'
import { InvalidParametersError } from '@helia/interface/errors'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { EdKeypair } from '@ucans/ucans'
import type { PeerId } from '@libp2p/interface-peer-id'

interface InitArgs {
  positionals?: string[]
  keyType: string
  bits: string
  port: string
  directory: string
  directoryMode: string
  configFileMode: string
}

export const init: Command<InitArgs> = {
  description: 'Initialize the node',
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
    }
  },
  async execute ({ keyType, bits, directory, directoryMode, configFileMode, port, stdout }) {
    const configFile = path.join(directory, 'config.json')
    const key = await generateKey(keyType, bits)

    if (key.publicKey == null || key.privateKey == null) {
      throw new InvalidParametersError('Generated PeerId had missing components')
    }

    const serverKeyPair = await EdKeypair.create({
      exportable: true
    })
    const serverKey = await serverKeyPair.export('base64url')

    await fs.mkdir(directory, {
      recursive: true,
      mode: parseInt(directoryMode, 8)
    })

    await fs.writeFile(configFile, `
{
  // Configuration for the gRPC API
  "grpc": {
    // A multiaddr that specifies the TCP port the gRPC server is listening on
    "address": "/ip4/127.0.0.1/tcp/${port}/ws/p2p/${key.toString()}",

    // The server key used to create ucans for operation permissions - note this is separate
    // to the peerId to let you rotate the server key while keeping the same peerId
    "serverKey": "${serverKey}"
  },

  // The private key portion of the node's PeerId as a base64url encoded string
  "peerId": {
    "publicKey": "${uint8ArrayToString(key.publicKey, 'base64url')}",
    "privateKey": "${uint8ArrayToString(key.privateKey, 'base64url')}"
  },

  // Where blocks are stored
  "blocks": "${path.join(directory, 'blocks')}",

  // libp2p configuration
  "libp2p": {
    "addresses": {
      "listen": [
        "/ip4/0.0.0.0/tcp/0",
        "/ip4/0.0.0.0/tcp/0/ws",

        // this is the gRPC port
        "/ip4/0.0.0.0/tcp/${port}/ws"
      ],
      "announce": [],
      "noAnnounce": [
        // this is the gRPC port
        "/ip4/0.0.0.0/tcp/${port}/ws"
      ]
    },
    "identify": {

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
