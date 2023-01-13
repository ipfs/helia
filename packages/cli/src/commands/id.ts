import type { Command } from './index.js'

interface IdArgs {
  positionals?: string[]
}

export const id: Command<IdArgs> = {
  command: 'id',
  description: 'Print information out this Helia node',
  example: '$ helia id',
  offline: true,
  async execute ({ helia, stdout }) {
    const result = await helia.id()

    stdout.write(JSON.stringify(result, null, 2) + '\n')
  }
}
