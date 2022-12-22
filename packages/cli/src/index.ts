#! /usr/bin/env node --trace-warnings
/* eslint-disable no-console */

import { parseArgs } from 'node:util'
import path from 'node:path'
import os from 'os'
import fs from 'node:fs'
import { Command, commands } from './commands/index.js'
import { InvalidParametersError } from '@helia/interface/errors'
import { printHelp } from './utils/print-help.js'
import { findHelia } from './utils/find-helia.js'
import stripJsonComments from 'strip-json-comments'
import type { Helia } from '@helia/interface'
import type { Libp2p } from '@libp2p/interface-libp2p'

/**
 * Typedef for the Helia config file
 */
export interface HeliaConfig {
  peerId: {
    publicKey: string
    privateKey: string
  }
  grpc: {
    address: string
    serverKey: string
  }
  blocks: string
  libp2p: {
    addresses: {
      listen: string[]
      announce: string[]
      noAnnounce: string[]
    }
  }
}

interface RootConfig {
  directory: string
  help: boolean
}

const root: Command<RootConfig> = {
  description: `Helia is an IPFS implementation in JavaScript

Subcommands:

${Object.entries(commands).map(([key, command]) => `  ${key}\t${command.description}`).sort().join('\n')}`,
  options: {
    directory: {
      description: 'The directory to load config from',
      type: 'string',
      default: path.join(os.homedir(), '.helia')
    },
    help: {
      description: 'Show help text',
      type: 'boolean'
    }
  },
  async execute () {}
}

async function main () {
  const command = parseArgs({
    allowPositionals: true,
    strict: true,
    options: root.options
  })

  // @ts-expect-error wat
  const configDir = command.values.directory

  if (configDir == null) {
    throw new InvalidParametersError('No config directory specified')
  }

  if (!fs.existsSync(configDir)) {
    // run the init command
    const parsed = parseArgs({
      allowPositionals: true,
      strict: true,
      options: commands.init.options
    })
    await commands.init.execute({
      ...parsed.values,
      positionals: parsed.positionals.slice(1),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    })
  }

  if (command.positionals.length > 0) {
    const subCommand = command.positionals[0]

    if (commands[subCommand] != null) {
      const com = commands[subCommand]

      // @ts-expect-error wat
      if (command.values.help === true) {
        printHelp(com, process.stdout)
      } else {
        const config = JSON.parse(stripJsonComments(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8')))

        const opts = parseArgs({
          allowPositionals: true,
          strict: true,
          options: com.options
        })

        let helia: Helia
        let libp2p: Libp2p | undefined

        if (subCommand !== 'daemon') {
          const res = await findHelia(config, com.offline)
          helia = res.helia
          libp2p = res.libp2p
        }

        await commands[subCommand].execute({
          ...opts.values,
          positionals: opts.positionals.slice(1),
          // @ts-expect-error wat
          helia,
          stdin: process.stdin,
          stdout: process.stdout,
          stderr: process.stderr,
          config
        })

        if (libp2p != null) {
          await libp2p.stop()
        }
      }

      return
    }
  }

  // no command specified, print help
  printHelp(root, process.stdout)
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
