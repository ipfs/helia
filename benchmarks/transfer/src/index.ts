/* eslint-disable no-console */

import type { CID } from 'multiformats/cid'
import { createHeliaBenchmark } from './helia.js'
import { createKuboBenchmark } from './kubo.js'
import bufferStream from 'it-buffer-stream'
import type { Multiaddr } from '@multiformats/multiaddr'
import prettyBytes from 'pretty-bytes'

const ONE_MEG = 1024 * 1024

export interface TransferBenchmark {
  teardown: () => Promise<void>
  addr: () => Promise<Multiaddr>
  dial: (multiaddr: Multiaddr) => Promise<void>
  add: (content: AsyncIterable<Uint8Array>, options: ImportOptions) => Promise<CID>
  get: (cid: CID) => Promise<void>
}

export interface ImportOptions {
  cidVersion?: 0 | 1
  rawLeaves?: boolean
  chunkSize?: number
  maxChildrenPerNode?: number
}

interface File {
  name: string
  options: ImportOptions
  size: number
}

const opts: Record<string, ImportOptions> = {
  'kubo defaults': {
    chunkSize: 256 * 1024,
    rawLeaves: false,
    cidVersion: 0,
    maxChildrenPerNode: 174
  },
  'filecoin defaults': {
    chunkSize: 1024 * 1024,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 1024
  },
/*  '256KiB block size': {
    chunkSize: 256 * 1024,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  },
  '512KiB block size': {
    chunkSize: 256 * 1024 * 2,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  },
  '1MB block size': {
    chunkSize: 1024 * 1024,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  },
  '2MB block size': {
    chunkSize: (1024 * 1024) * 2,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  },
  '3MB block size': {
    chunkSize: (1024 * 1024) * 3,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  },
  'Max block size': {
    chunkSize: 4193648,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 174
  }
  // Kubo will not sent bitswap messages larger than this
*/
}

const tests: Record<string, File[]> = {}

for (const [name, options] of Object.entries(opts)) {
  tests[name] = []

  for (let i = 100; i < 1100; i += 100) {
    tests[name].push({
      name: `${i}`,
      options,
      size: ONE_MEG * i
    })

    console.info(prettyBytes(ONE_MEG * i))
  }
}

const impls: Array<{ name: string, create: () => Promise<TransferBenchmark> }> = [{
  name: 'helia',
  create: async () => await createHeliaBenchmark()
}, {
  name: 'kubo',
  create: async () => await createKuboBenchmark()
}]

async function main (): Promise<void> {
  for (const [name, files] of Object.entries(tests)) {
    for (const implA of impls) {
      for (const implB of impls) {
        console.info(`${implA.name} -> ${implB.name} ${name}`)

        for (const file of files) {
          const subjectA = await implA.create()
          const subjectB = await implB.create()

          const addr = await subjectB.addr()
          await subjectA.dial(addr)

          const cid = await subjectA.add(bufferStream(file.size), file.options)

          const start = Date.now()

          // b pulls from a
          await subjectB.get(cid)

          console.info(`${Date.now() - start}`)

          await subjectA.teardown()
          await subjectB.teardown()
        }
      }
    }
  }
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
