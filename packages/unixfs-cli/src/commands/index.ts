import type { Command } from '@helia/cli-utils'
import { add } from './add.js'
import { cat } from './cat.js'
import { stat } from './stat.js'

export const commands: Array<Command<any>> = [
  add,
  cat,
  stat
]
