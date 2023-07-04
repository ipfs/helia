/* eslint-disable no-loop-func,no-console */

import crypto from 'node:crypto'
import * as dagPb from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { Bench } from 'tinybench'
import { createHeliaBenchmark } from './helia.js'
import { createIpfsBenchmark } from './ipfs.js'
import { createKuboBenchmark } from './kubo.js'

const PINNED_DAG_COUNT = parseInt(process.env.INCREMENT ?? '10000')
const GARBAGE_BLOCK_COUNT = parseInt(process.env.INCREMENT ?? '10000')
const ITERATIONS = parseInt(process.env.ITERATIONS ?? '5')
const RESULT_PRECISION = 2

export interface GcBenchmark {
  gc: () => Promise<void>
  teardown: () => Promise<void>
  pin: (cid: CID) => Promise<void>
  putBlocks: (blocks: Array<{ key: CID, value: Uint8Array }>) => Promise<void>
  clearPins: () => Promise<number>
  isPinned: (cid: CID) => Promise<boolean>
  hasBlock: (cid: CID) => Promise<boolean>
}

const blocks: Array<{ key: CID, value: Uint8Array }> = []
const garbageBlocks: Array<{ key: CID, value: Uint8Array }> = []
const pins: CID[] = []

/**
 * Create blocks that will be pinned and/or deleted
 */
async function generateBlocks (): Promise<void> {
  // generate DAGs of two blocks linked by a root that will be pinned
  for (let i = 0; i < PINNED_DAG_COUNT; i++) {
    const block1 = dagPb.encode({
      Data: crypto.randomBytes(5),
      Links: []
    })
    const mh1 = await sha256.digest(block1)
    const cid1 = CID.createV1(dagPb.code, mh1)

    const block2 = dagPb.encode({
      Data: crypto.randomBytes(5),
      Links: []
    })
    const mh2 = await sha256.digest(block2)
    const cid2 = CID.createV1(dagPb.code, mh2)

    const block3 = dagPb.encode({
      Links: [{
        Hash: cid1,
        Tsize: block1.length
      }, {
        Hash: cid2,
        Tsize: block2.length
      }]
    })
    const mh3 = await sha256.digest(block3)
    const cid3 = CID.createV1(dagPb.code, mh3)

    blocks.push({ key: cid1, value: block1 })
    blocks.push({ key: cid2, value: block2 })
    blocks.push({ key: cid3, value: block3 })
    pins.push(cid3)
  }

  // generate garbage blocks that will be deleted
  for (let i = 0; i < GARBAGE_BLOCK_COUNT; i++) {
    const block = dagPb.encode({
      Data: crypto.randomBytes(5),
      Links: []
    })
    const mh = await sha256.digest(block)
    const cid = CID.createV1(dagPb.code, mh)

    garbageBlocks.push({ key: cid, value: block })
  }
}

async function addBlocks (benchmark: GcBenchmark): Promise<void> {
  // add all the blocks
  await benchmark.putBlocks(blocks)
  await benchmark.putBlocks(garbageBlocks)
}

async function pinBlocks (benchmark: GcBenchmark): Promise<void> {
  // add all of the pins
  for (const pin of pins) {
    await benchmark.pin(pin)
  }
}

const impls: Array<{ name: string, create: () => Promise<GcBenchmark>, results: { gc: number[], clearedPins: number[], addedBlocks: number[], pinnedBlocks: number[] } }> = [{
  name: 'helia',
  create: async () => createHeliaBenchmark(),
  results: {
    gc: [],
    clearedPins: [],
    addedBlocks: [],
    pinnedBlocks: []
  }
}, {
  name: 'ipfs',
  create: async () => createIpfsBenchmark(),
  results: {
    gc: [],
    clearedPins: [],
    addedBlocks: [],
    pinnedBlocks: []
  }
}, {
  name: 'kubo',
  create: async () => createKuboBenchmark(),
  results: {
    gc: [],
    clearedPins: [],
    addedBlocks: [],
    pinnedBlocks: []
  }
}]

async function main (): Promise<void> {
  let subject: GcBenchmark

  await generateBlocks()

  const suite = new Bench({
    iterations: ITERATIONS,
    time: 1
  })

  for (const impl of impls) {
    suite.add(impl.name, async () => {
      const start = Date.now()
      await subject.gc()
      impl.results.gc.push(Date.now() - start)
    }, {
      beforeAll: async () => {
        subject = await impl.create()
      },
      beforeEach: async () => {
        let start = Date.now()
        const pinCount = await subject.clearPins()

        if (pinCount > 0) {
          impl.results.clearedPins.push(Date.now() - start)
        }

        start = Date.now()
        await addBlocks(subject)
        impl.results.addedBlocks.push(Date.now() - start)

        start = Date.now()
        await pinBlocks(subject)
        impl.results.pinnedBlocks.push(Date.now() - start)
      },
      afterAll: async () => {
        await subject.teardown()
      }
    })
  }

  await suite.run()

  if (process.env.INCREMENT != null) {
    if (process.env.ITERATION === '1') {
      console.info('implementation, count, clear pins (ms), add blocks (ms), add pins (ms), gc (ms)')
    }

    for (const impl of impls) {
      console.info(
        `${impl.name},`,
        `${process.env.INCREMENT},`,
        `${(impl.results.clearedPins.reduce((acc, curr) => acc + curr, 0) / impl.results.clearedPins.length).toFixed(RESULT_PRECISION)},`,
        `${(impl.results.addedBlocks.reduce((acc, curr) => acc + curr, 0) / impl.results.addedBlocks.length).toFixed(RESULT_PRECISION)},`,
        `${(impl.results.pinnedBlocks.reduce((acc, curr) => acc + curr, 0) / impl.results.pinnedBlocks.length).toFixed(RESULT_PRECISION)},`,
        `${(impl.results.gc.reduce((acc, curr) => acc + curr, 0) / impl.results.gc.length).toFixed(RESULT_PRECISION)}`
      )
    }
  } else {
    console.table(suite.tasks.map(({ name, result }) => ({
      Implementation: name,
      'ops/s': result?.hz.toFixed(RESULT_PRECISION),
      'ms/op': result?.period.toFixed(RESULT_PRECISION),
      runs: result?.samples.length
    })))
  }
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
