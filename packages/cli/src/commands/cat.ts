import type { Command } from './index.js'

interface CatArgs {
  positionals?: string[]
  offset?: string
  length?: string
}

export const cat: Command<CatArgs> = {
  command: 'cat',
  description: 'Fetch and cat an IPFS path referencing a file',
  example: '$ helia cat <CID>',
  offline: true,
  options: {
    offset: {
      description: 'Where to start reading the file from',
      type: 'string',
      short: 'o'
    },
    length: {
      description: 'How many bytes to read from the file',
      type: 'string',
      short: 'l'
    }
  },
  async execute ({ positionals, offset, length, helia, stdout }) {
    if (positionals == null || positionals.length === 0) {
      throw new TypeError('Missing positionals')
    }
  }
}
