import type { Command } from '@helia/cli-utils'
import { exporter } from 'ipfs-unixfs-exporter'
import { CID } from 'multiformats/cid'
import * as format from '@helia/cli-utils/format'
import type { Formatable } from '@helia/cli-utils/format'

interface StatArgs {
  positionals?: string[]
  explain?: boolean
}

export const stat: Command<StatArgs> = {
  command: 'stat',
  description: 'Display statistics about a dag',
  example: '$ unixfs stat <CID>',
  options: {
    explain: {
      description: 'Print diagnostic information while trying to resolve the block',
      type: 'boolean',
      default: false
    }
  },
  async execute ({ positionals, helia, stdout, explain }) {
    if (positionals == null || positionals.length === 0) {
      throw new TypeError('Missing positionals')
    }

    let progress: undefined | ((evt: Event) => void)

    if (explain === true) {
      progress = (evt: Event) => {
        stdout.write(`${evt.type}\n`)
      }
    }

    const cid = CID.parse(positionals[0])
    const entry = await exporter(cid, helia.blockstore, {
      // @ts-expect-error
      progress
    })

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
