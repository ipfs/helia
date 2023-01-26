import { unixfs } from '@helia/unixfs'
import { CID } from 'multiformats'

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
    if (offset != null && !Number.isInteger(offset)) {
      throw new TypeError('Invalid offset')
    }
    if (length != null && !Number.isInteger(length)) {
      throw new TypeError('Invalid length')
    }
    const options = {
      offset: offset != null ? Number(offset) : undefined,
      length: length != null ? Number(length) : undefined
    }

    const fs = unixfs(helia)
    const cid = CID.parse(positionals[0])
    const result = await fs.cat(cid, options)
    stdout.write(result.toString())
  }
}
