import type { ParseArgsConfig } from 'node:util'
import type { Helia } from '@helia/interface'
import { InvalidParametersError } from '@helia/interface/errors'
import { parseArgs } from 'node:util'
import { findHeliaDir } from './find-helia-dir.js'
import path from 'node:path'
import { printHelp } from './print-help.js'
import fs from 'node:fs'
import { findHelia } from './find-helia.js'
import type { Libp2p } from 'libp2p'

/**
 * Extends the internal node type to add a description to the options
 */
export interface ParseArgsOptionConfig {
  /**
   * Type of argument.
   */
  type: 'string' | 'boolean'

  /**
   * Whether this option can be provided multiple times.
   * If `true`, all values will be collected in an array.
   * If `false`, values for the option are last-wins.
   *
   * @default false.
   */
  multiple?: boolean

  /**
   * A single character alias for the option.
   */
  short?: string

  /**
   * The default option value when it is not set by args.
   * It must be of the same type as the the `type` property.
   * When `multiple` is `true`, it must be an array.
   *
   * @since v18.11.0
   */
  default?: string | boolean | string[] | boolean[]

  /**
   * A description used to generate help text
   */
  description: string

  /**
   * If specified the value must be in this list
   */
  valid?: string[]
}

type ParseArgsOptionsConfig = Record<string, ParseArgsOptionConfig>

export interface CommandOptions <T extends ParseArgsOptionsConfig> extends ParseArgsConfig {
  /**
   * Used to describe arguments known to the parser.
   */
  options?: T
}

export interface Command<T = {}> {
  /**
   * The command name
   */
  command: string

  /**
   * Used to generate help text
   */
  description: string

  /**
   * Used to generate help text
   */
  example?: string

  /**
   * Specify if this command can be run offline (default true)
   */
  offline?: boolean

  /**
   * Specify if this command can be run online (default true)
   */
  online?: boolean

  /**
   * Configuration for the command
   */
  options?: ParseArgsOptionsConfig

  /**
   * Run the command
   */
  execute: (ctx: Context & T) => Promise<void>

  /**
   * Subcommands of the current command
   */
  subcommands?: Array<Command<any>>
}

export interface Context {
  helia: Helia
  directory: string
  stdin: NodeJS.ReadStream
  stdout: NodeJS.WriteStream
  stderr: NodeJS.WriteStream
}

export function createCliConfig <T> (options?: T, strict?: boolean): ParseArgsConfig {
  return {
    allowPositionals: true,
    strict: strict ?? true,
    options: {
      help: {
        // @ts-expect-error description field not defined
        description: 'Show help text',
        type: 'boolean'
      },
      ...options
    }
  }
}

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
    bootstrap: string[]
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
  command: '',
  description: '',
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

export async function cli (command: string, description: string, subcommands: Array<Command<any>>): Promise<void> {
  const rootCommand: Command<RootArgs> = {
    ...root,
    command,
    description,
    subcommands
  }
  const config = createCliConfig(rootCommand.options, false)
  const rootCommandArgs = parseArgs(config)
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
    printHelp(rootCommand, process.stdout)
    return
  }

  if (!fs.existsSync(configDir)) {
    const init = subcommands.find(command => command.command === 'init')

    if (init == null) {
      throw new Error('Could not find init command')
    }

    // run the init command
    const parsed = parseArgs(createCliConfig(init.options, false))

    if (parsed.values.help === true) {
      printHelp(init, process.stdout)
      return
    }

    await init.execute({
      ...parsed.values,
      positionals: parsed.positionals.slice(1),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      directory: configDir
    })

    if (rootCommandArgs.positionals[0] === 'init') {
      // if init was specified explicitly we can bail because we just ran init
      return
    }
  }

  if (rootCommandArgs.positionals.length > 0) {
    let subCommand: Command<any> = rootCommand
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

    const subCommandArgs = parseArgs(createCliConfig(subCommand.options))

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
  printHelp(rootCommand, process.stdout)
}
