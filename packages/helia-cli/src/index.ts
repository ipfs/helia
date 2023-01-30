#! /usr/bin/env node --trace-warnings
/* eslint-disable no-console */

import { cli } from '@helia/cli-utils'
import kleur from 'kleur'
import { commands } from './commands/index.js'

async function main (): Promise<void> {
  const command = 'helia'
  const description = `${kleur.bold('Helia')} is an ${kleur.cyan('IPFS')} implementation written in ${kleur.yellow('JavaScript')}`

  await cli(command, description, commands)
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
