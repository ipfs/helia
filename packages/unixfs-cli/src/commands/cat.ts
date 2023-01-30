import type { Command } from '@helia/cli-utils'
import { exporter } from 'ipfs-unixfs-exporter'
import { CID } from 'multiformats/cid'

interface CatArgs {
  positionals?: string[]
  offset?: string
  length?: string
}

export const cat: Command<CatArgs> = {
  command: 'cat',
  description: 'Fetch and cat an IPFS path referencing a file',
  example: '$ unixfs cat <CID>',
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
    },
    progress: {
      description: 'Display information about how the CID is being resolved',
      type: 'boolean',
      short: 'p'
    }
  },
  async execute ({ positionals, offset, length, helia, stdout }) {
    if (positionals == null || positionals.length === 0) {
      throw new TypeError('Missing positionals')
    }

    const cid = CID.parse(positionals[0])
    const entry = await exporter(cid, helia.blockstore, {
      offset: offset != null ? Number(offset) : undefined,
      length: length != null ? Number(length) : undefined
    })

    if (entry.type !== 'file' && entry.type !== 'raw') {
      throw new Error('UnixFS path was not a file')
    }

    for await (const buf of entry.content()) {
      stdout.write(buf)
    }
  }
}
