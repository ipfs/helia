import type { HeliaConfig } from './index.js'
import { FsDatastore } from 'datastore-fs'
import stripJsonComments from 'strip-json-comments'
import fs from 'node:fs'
import path from 'node:path'
import * as readline from 'node:readline/promises'
import { DefaultKeyChain } from '@libp2p/keychain'
import type { KeyChain } from '@libp2p/interface-keychain'

export async function loadRpcKeychain (configDir: string): Promise<KeyChain> {
  const config: HeliaConfig = JSON.parse(stripJsonComments(fs.readFileSync(path.join(configDir, 'helia.json'), 'utf-8')))
  const datastore = new FsDatastore(config.rpc.datastore, {
    createIfMissing: true
  })
  await datastore.open()

  let password = config.rpc.keychain.password

  if (password == null) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    password = await rl.question('Enter libp2p keychain password: ')
  }

  return new DefaultKeyChain({
    datastore
  }, {
    pass: password,
    dek: {
      keyLength: 512 / 8,
      iterationCount: 10000,
      hash: 'sha2-512',
      salt: config.rpc.keychain.salt
    }
  })
}
