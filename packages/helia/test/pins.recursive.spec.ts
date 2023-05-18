/* eslint-env mocha */
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createLibp2p } from 'libp2p'
import { createHelia } from '../src/index.js'
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
    await helia.pins.add(dag['level-0'].cid)

    // all sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.pins.isPinned(cid)).to.eventually.be.true(`did not pin ${name}`)
      }
    }
  })

  it('unpins recursively', async () => {
    await helia.pins.add(dag['level-0'].cid)
    await helia.pins.rm(dag['level-0'].cid)

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.pins.isPinned(cid)).to.eventually.be.false(`did not unpin ${name}`)
      }
    }
  })

  it('does not delete a pinned sub-block', async () => {
    await helia.pins.add(dag['level-0'].cid)

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(helia.blockstore.delete(cid)).to.eventually.be.rejected
          .with.property('message', 'CID was pinned', `allowed deleting pinned block ${name}`)
      }
    }
  })
})
