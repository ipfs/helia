import type { Command } from './index.js'
import { exporter } from 'ipfs-unixfs-exporter'
import { CID } from 'multiformats/cid'
import * as format from '../utils/format.js'
import type { Formatable } from '../utils/format.js'

interface StatArgs {
  positionals?: string[]
}

export const stat: Command<StatArgs> = {
  command: 'stat',
  description: 'Display statistics about a dag',
  example: '$ helia stat <CID>',
  options: {
  },
  async execute ({ positionals, helia, stdout }) {
    if (positionals == null || positionals.length === 0) {
      throw new TypeError('Missing positionals')
    }

    const cid = CID.parse(positionals[0])
    const entry = await exporter(cid, helia.blockstore)

    const items: Formatable[] = [
      format.table([
        format.row('CID', entry.cid.toString()),
        format.row('Type', entry.type),
        format.row('Size', `${entry.size}`)
      ])
    ]

    format.formatter(
      stdout,
      items
    )
  }
}
