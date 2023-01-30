import { init } from './init.js'
import { daemon } from './daemon.js'
import { id } from './id.js'
import { status } from './status.js'
import type { Command } from '@helia/cli-utils'

export const commands: Array<Command<any>> = [
  init,
  daemon,
  id,
  status
]
