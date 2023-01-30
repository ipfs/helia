import type { Command } from './index.js'
import * as format from './format.js'
import type { Formatable } from './format.js'
import kleur from 'kleur'

export function printHelp (command: Command<any>, stdout: NodeJS.WriteStream): void {
  const items: Formatable[] = [
    format.header(command.description)
  ]

  if (command.example != null) {
    items.push(
      format.subheader('Example:'),
      format.paragraph(command.example)
    )
  }

  if (command.subcommands != null) {
    items.push(
      format.subheader('Subcommands:'),
      format.table(
        command.subcommands.map(command => format.row(
          `  ${command.command}`,
          kleur.white(command.description)
        ))
      )
    )
  }

  if (command.options != null) {
    items.push(
      format.subheader('Options:'),
      format.table(
        Object.entries(command.options).map(([key, option]) => format.row(
          `  --${key}`,
          kleur.white(option.description),
          option.default != null ? kleur.grey(`[default: ${option.default}]`) : ''
        ))
      )
    )
  }

  format.formatter(
    stdout,
    items
  )
}
