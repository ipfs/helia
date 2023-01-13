import kleur from 'kleur'

export function formatter (stdout: NodeJS.WriteStream, items: Formatable[]): void {
  items.forEach(item => stdout.write(item()))
}

export interface Formatable {
  (): string
}

export function header (string: string): Formatable {
  return (): string => {
    return `\n${string}\n`
  }
}

export function subheader (string: string): Formatable {
  return (): string => {
    return `\n${string}\n`
  }
}

export function paragraph (string: string): Formatable {
  return (): string => {
    return kleur.white(`\n${string}\n`)
  }
}

export function table (rows: FormatableRow[]): Formatable {
  const cellLengths: string[] = []

  for (const row of rows) {
    const cells = row()

    for (let i = 0; i < cells.length; i++) {
      const textLength = cells[i].length

      if (cellLengths[i] == null || cellLengths[i].length < textLength) {
        cellLengths[i] = new Array(textLength).fill(' ').join('')
      }
    }
  }

  return (): string => {
    const output: string[] = []

    for (const row of rows) {
      const cells = row()
      const text: string[] = []

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]
        text.push((cell + cellLengths[i]).substring(0, cellLengths[i].length))
      }

      output.push(text.join('  ') + '\n')
    }

    return output.join('')
  }
}

export interface FormatableRow {
  rowLengths: number[]
  (): string[]
}

export function row (...cells: string[]): FormatableRow {
  const formatable = (): string[] => {
    return cells
  }
  formatable.rowLengths = cells.map(str => str.length)

  return formatable
}
