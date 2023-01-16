import type { Command } from './index.js'
import { unixfs } from '@helia/unixfs'

interface AddArgs {
  positionals?: string[]
  fs: string
}

export const add: Command<AddArgs> = {
  command: 'add',
  description: 'Add a file or directory to your helia node',
  example: '$ helia add path/to/file.txt',
  offline: true,
  options: {
    fs: {
      description: 'Which filesystem to use',
      type: 'string',
      default: 'unixfs'
    }
  },
  async execute ({ positionals, helia, stdout }) {
    const options = {}

    const fs = unixfs(helia)

    if (positionals == null || positionals.length === 0) {
      // import from stdin
    } else {
      for (const input of positionals) {
        for await (const result of fs.add({
          path: input
        }, options)) {
          stdout.write(result.cid.toString() + '\n')
        }
      }
    }
  }
}
