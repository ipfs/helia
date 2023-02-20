import Benchmark from 'benchmark'
import { CID } from 'multiformats/cid'
import { createHeliaBenchmark } from './helia.js'
import { createIpfsBenchmark } from './ipfs.js'
import * as dagPb from '@ipld/dag-pb'
import crypto from 'node:crypto'
import { sha256 } from 'multiformats/hashes/sha2'
import { createKuboBenchmark } from './kubo.js'

export interface GcBenchmark {
  gc: () => Promise<void>
  teardown: () => Promise<void>
  pin: (cid: CID) => Promise<void>
  putBlock: (cid: CID, block: Uint8Array) => Promise<void>
  clearPins: () => Promise<void>
}

const blocks: Array<{ cid: CID, block: Uint8Array }> = []
const pins: CID[] = []

/**
 * Create blocks that will be pinned and/or deleted
 */
async function generateBlocks (): Promise<void> {
  // generate DAGs of two blocks linked by a root that will be pinned
  for (let i = 0; i < 100; i++) {
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

    blocks.push({ cid: cid1, block: block1 })
    blocks.push({ cid: cid2, block: block2 })
    blocks.push({ cid: cid3, block: block3 })
    pins.push(cid3)
  }

  // generate garbage blocks that will be deleted
  for (let i = 0; i < 100; i++) {
    const block = dagPb.encode({
      Data: crypto.randomBytes(5),
      Links: []
    })
    const mh = await sha256.digest(block)
    const cid = CID.createV1(dagPb.code, mh)

    blocks.push({ cid, block })
  }
}

async function addBlocks (benchmark: GcBenchmark): Promise<void> {
  // ensure there are no existing pins
  await benchmark.clearPins()

  // seems to be necessary for js-ipfs
  const emptyDir = CID.parse('QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn')
  await benchmark.putBlock(emptyDir, Uint8Array.from([0xa, 0x2, 0x8, 0x1]))
  await benchmark.pin(emptyDir)

  // add all the blocks
  for (const { cid, block } of blocks) {
    await benchmark.putBlock(cid, block)
  }

  // add all of the pins
  for (const pin of pins) {
    await benchmark.pin(pin)
  }
}

async function main (): Promise<void> {
  const helia = await createHeliaBenchmark()
  const ipfs = await createIpfsBenchmark()
  const kubo = await createKuboBenchmark()

  await generateBlocks()

  new Benchmark.Suite()
    .add('helia', async (d: any) => {
      await addBlocks(helia)
      await helia.gc()

      d.resolve()
    }, { defer: true })
    .add('ipfs', async (d: any) => {
      await addBlocks(ipfs)
      await ipfs.gc()

      d.resolve()
    }, { defer: true })
    .add('kubo', async (d: any) => {
      await addBlocks(kubo)
      await kubo.gc()

      d.resolve()
    }, { defer: true })
    .on('error', (err: Error) => {
      console.error(err) // eslint-disable-line no-console
    })
    .on('cycle', (event: any) => {
      console.info(String(event.target)) // eslint-disable-line no-console
    })
    .on('complete', async function () {
      await helia.teardown()
      await ipfs.teardown()
      await kubo.teardown()

      // @ts-expect-error types are wrong
      console.info(`Fastest is ${this.filter('fastest').map('name')}`) // eslint-disable-line no-console
    })
    // run async
    .run({ async: true })
}

main().catch(err => {
  console.error(err) // eslint-disable-line no-console
  process.exit(1)
})
