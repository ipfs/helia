import type { Command } from '@helia/cli-utils'

interface IdArgs {
  positionals?: string[]
}

export const id: Command<IdArgs> = {
  command: 'id',
  description: 'Print information out this Helia node',
  example: '$ helia id',
  async execute ({ helia, stdout }) {
    const result = await helia.info()

    stdout.write(JSON.stringify(result, null, 2) + '\n')
  }
}
