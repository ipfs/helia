/* eslint-env mocha */
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import all from 'it-all'
import parallel from 'it-parallel'
import { createLibp2p } from 'libp2p'
import { type AddPinEvents, createHelia } from '../src/index.js'
import { createDag, type DAGNode } from './fixtures/create-dag.js'
import { dagWalker } from './fixtures/dag-walker.js'
import type { Helia } from '@helia/interface'

describe('pins (recursive)', () => {
  let helia: Helia
  let dag: Record<string, DAGNode>

  beforeEach(async () => {
    const blockstore = new MemoryBlockstore()

    // arbitrary CID codec value
    const codec = 7

    // create a DAG, two levels deep with each level having three children
    dag = await createDag(codec, blockstore, 2, 3)

    helia = await createHelia({
      blockBrokers: [],
      datastore: new MemoryDatastore(),
      blockstore,
      libp2p: await createLibp2p({
        transports: [
          webSockets()
        ],
        connectionEncryption: [
          noise()
        ],
        streamMuxers: [
          yamux()
        ]
      }),
      dagWalkers: [
        dagWalker(codec, dag)
      ]
    })
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  it('pins a block recursively', async () => {
    await all(parallel(helia.pins.add(dag['level-0'].cid)))

    // all sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.pins.isPinned(cid)).to.eventually.be.true(`did not pin ${name}`)
      }
    }
  })

  it('unpins recursively', async () => {
    await all(parallel(helia.pins.add(dag['level-0'].cid)))
    await all(parallel(helia.pins.rm(dag['level-0'].cid)))

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.pins.isPinned(cid)).to.eventually.be.false(`did not unpin ${name}`)
      }
    }
  })

  it('does not delete a pinned sub-block', async () => {
    await all(parallel(helia.pins.add(dag['level-0'].cid)))

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.blockstore.delete(cid)).to.eventually.be.rejected
          .with.property('message', 'CID was pinned', `allowed deleting pinned block ${name}`)
      }
    }
  })

  it('can resume an interrupted pinning operation', async () => {
    // dag has 13 nodes. We should abort after 5
    const events: AddPinEvents[] = []
    const getPinIterator = (): ReturnType<typeof helia.pins.add> => helia.pins.add(dag['level-0'].cid, {
      onProgress: (evt) => {
        if (evt.type === 'helia:pin:add') {
          events.push(evt)
        }
      }
    })
    const pinIter = getPinIterator()
    let output = await pinIter.next()
    const firstTryPins = []

    while (output.done === false && events.length < 5) {
      firstTryPins.push(await output.value())
      output = await pinIter.next()
    }

    expect(firstTryPins).to.have.lengthOf(5)
    expect(events.length).to.eq(5)
    expect(output.done).to.eq(false) // we're not actually done. We simulated a crash

    // now resume, and consume the entire iterator to completion
    const pin = await all(parallel(getPinIterator()))

    expect(pin).to.have.lengthOf(13)
    // we did not re-pin things we already pinned
    expect(events.length).to.eq(13)
  })
})
