/* eslint-disable no-console */

import type { CID } from 'multiformats/cid'
import type { Multiaddr } from '@multiformats/multiaddr'
import prettyBytes from 'pretty-bytes'
import { execa } from 'execa'
import { createRelay } from './relay.js'
import { createTests } from './tests.js'
import { Test } from './test.js'

const ONE_MEG = 1024 * 1024
const relay = await createRelay()

export interface TransferBenchmark {
  teardown: () => Promise<void>
  addrs: () => Promise<Multiaddr[]>
  dial: (multiaddrs: Multiaddr[]) => Promise<void>
  add: (content: AsyncIterable<Uint8Array>, options: ImportOptions) => Promise<CID>
  get: (cid: CID) => Promise<void>
}

export interface ImportOptions {
  cidVersion?: 0 | 1
  rawLeaves?: boolean
  chunkSize?: number
  maxChildrenPerNode?: number
}

export interface File {
  name: string
  options: ImportOptions
  size: number
}

const opts: Record<string, ImportOptions> = {
  /*
  'kubo defaults': {
    chunkSize: 256 * 1024,
    rawLeaves: false,
    cidVersion: 0,
    maxChildrenPerNode: 174
  },
  */
  'filecoin defaults': {
    chunkSize: 1024 * 1024,
    rawLeaves: true,
    cidVersion: 1,
    maxChildrenPerNode: 1024
  }
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
  }
}

console.info(
  'Implementation,',
  tests[Object.keys(opts)[0]]
    .map(file => prettyBytes(ONE_MEG * Number(file.name)))
    .join(', ')
)

async function main (): Promise<void> {
  const impls = createTests(relay.libp2p.getMultiaddrs()[0]).map(test => {
    return new Test({
      name: test.name,
      startSender: (file: File) => {
        return execa(test.senderExec ?? 'node', [...(test.senderArgs ?? []), './dist/src/runner/helia-sender.js'], {
          env: {
            HELIA_TYPE: 'sender',
            HELIA_IMPORT_OPTIONS: JSON.stringify(file.options),
            HELIA_FILE_SIZE: `${file.size}`,
            HELIA_LISTEN: test.senderListen,
            HELIA_TRANSPORTS: test.senderTransports,
            HELIA_DATASTORE: test.senderDatastore,
            HELIA_BLOCKSTORE: test.senderBlockstore
          }
        })
      },
      startRecipient: (cid: string, multiaddrs: string) => {
        return execa(test.recipientExec ?? 'node', [...(test.recipientArgs ?? []), './dist/src/runner/helia-recipient.js'], {
          env: {
            HELIA_TYPE: 'recipient',
            HELIA_CID: cid,
            HELIA_MULTIADDRS: multiaddrs,
            HELIA_TRANSPORTS: test.recipientTransports,
            HELIA_DATASTORE: test.recipientDatastore,
            HELIA_BLOCKSTORE: test.recipientBlockstore
          }
        })
      }
    })
  })

  for (const [name, files] of Object.entries(tests)) {
    for (const impl of impls) {
      process.stdout.write(`${impl.name} ${name}`)

      for (const file of files) {
        const time = await impl.runTest(file)

        process.stdout.write(`, ${time}`)
      }

      process.stdout.write('\n')
    }
  }

  await relay.stop()
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
