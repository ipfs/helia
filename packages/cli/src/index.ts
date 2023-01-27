#! /usr/bin/env node --trace-warnings
/* eslint-disable no-console */

import { parseArgs } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import { Command, commands } from './commands/index.js'
import { InvalidParametersError } from '@helia/interface/errors'
import { printHelp } from './utils/print-help.js'
import { findHelia } from './utils/find-helia.js'
import kleur from 'kleur'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'
import { findHeliaDir } from './utils/find-helia-dir.js'
import { config } from './utils/config.js'

/**
 * Typedef for the Helia config file
 */
export interface HeliaConfig {
  blockstore: string
  datastore: string
  libp2p: {
    addresses: {
      listen: string[]
      announce: string[]
      noAnnounce: string[]
    }
    keychain: {
      salt: string
      password?: string
    }
  }
  rpc: {
    datastore: string
    keychain: {
      salt: string
      password?: string
    }
  }
}

export interface RootArgs {
  positionals: string[]
  directory: string
  help: boolean
  rpcAddress: string
  user: string
}

const root: Command<RootArgs> = {
  command: 'helia',
  description: `${kleur.bold('Helia')} is an ${kleur.cyan('IPFS')} implementation in ${kleur.yellow('JavaScript')}`,
  subcommands: commands,
  options: {
    directory: {
      description: 'The directory used by Helia to store config and data',
      type: 'string',
      default: findHeliaDir()
    },
    rpcAddress: {
      description: 'The multiaddr of the Helia node',
      type: 'string',
      default: path.join(findHeliaDir(), 'rpc.sock')
    },
    user: {
      description: 'The name of the RPC user',
      type: 'string',
      default: process.env.USER
    }
  },
  async execute () {}
}

async function main (): Promise<void> {
  const rootCommandArgs = parseArgs(config(root.options))
  const configDir = rootCommandArgs.values.directory

  if (configDir == null || typeof configDir !== 'string') {
    throw new InvalidParametersError('No config directory specified')
  }

  if (typeof rootCommandArgs.values.rpcAddress !== 'string') {
    throw new InvalidParametersError('No RPC address specified')
  }

  if (typeof rootCommandArgs.values.user !== 'string') {
    throw new InvalidParametersError('No RPC user specified')
  }

  if (rootCommandArgs.values.help === true && rootCommandArgs.positionals.length === 0) {
    printHelp(root, process.stdout)
    return
  }

  if (!fs.existsSync(configDir)) {
    const init = commands.find(command => command.command === 'init')

    if (init == null) {
      throw new Error('Could not find init command')
    }

    // run the init command
    const parsed = parseArgs(config(init.options))

    if (parsed.values.help === true) {
      printHelp(init, process.stdout)
      return
    }

    await init.execute({
      ...parsed.values,
      positionals: parsed.positionals.slice(1),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    })

    if (rootCommandArgs.positionals[0] === 'init') {
      // if init was specified explicitly we can bail because we just ran init
      return
    }
  }

  if (rootCommandArgs.positionals.length > 0) {
    let subCommand: Command<any> = root
    let subCommandDepth = 0

    for (let i = 0; i < rootCommandArgs.positionals.length; i++) {
      const positional = rootCommandArgs.positionals[i]

      if (subCommand.subcommands == null) {
        break
      }

      const sub = subCommand.subcommands.find(c => c.command === positional)

      if (sub != null) {
        subCommandDepth++
        subCommand = sub
      }
    }

    if (subCommand == null) {
      throw new Error('Command not found')
    }

    const subCommandArgs = parseArgs(config(subCommand.options))

    if (subCommandArgs.values.help === true) {
      printHelp(subCommand, process.stdout)
      return
    }

    let helia: Helia | undefined
    let libp2p: Libp2p | undefined

    if (subCommand.command !== 'daemon' && subCommand.command !== 'status') {
      const res = await findHelia(configDir, rootCommandArgs.values.rpcAddress, rootCommandArgs.values.user, subCommand.offline, subCommand.online)
      helia = res.helia
      libp2p = res.libp2p
    }

    await subCommand.execute({
      ...rootCommandArgs.values,
      ...subCommandArgs.values,
      positionals: subCommandArgs.positionals.slice(subCommandDepth),
      helia,
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      directory: configDir
    })

    if (libp2p != null) {
      await libp2p.stop()
    }

    return
  }

  // no command specified, print help
  printHelp(root, process.stdout)
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
