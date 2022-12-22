import type { Command } from '../commands/index.js'

export function printHelp (command: Command<any>, stdout: NodeJS.WriteStream): void {
  stdout.write('\n')
  stdout.write(`${command.description}\n`)
  stdout.write('\n')

  if (command.example != null) {
    stdout.write('Example:\n')
    stdout.write('\n')
    stdout.write(`${command.example}\n`)
    stdout.write('\n')
  }

  const options = Object.entries(command.options ?? {})

  if (options.length > 0) {
    stdout.write('Options:\n')

    Object.entries(command.options ?? {}).forEach(([key, option]) => {
      stdout.write(`  --${key}\t${option.description}\n`)
    })
    stdout.write('\n')
  }
}
