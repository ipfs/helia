import { add } from './add.js'
import { cat } from './cat.js'
import { init } from './init.js'
import { daemon } from './daemon.js'
import { id } from './id.js'
import { status } from './status.js'
import { stat } from './stat.js'
import type { Helia } from '@helia/interface'
import type { ParseArgsConfig } from 'node:util'
import { rpc } from './rpc/index.js'

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

export interface CommandOptions extends ParseArgsConfig {
  /**
   * Used to describe arguments known to the parser.
   */
  options?: ParseArgsOptionsConfig
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

export const commands: Array<Command<any>> = [
  add,
  cat,
  init,
  daemon,
  id,
  status,
  rpc,
  stat
]
