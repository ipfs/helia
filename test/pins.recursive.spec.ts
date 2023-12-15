/* eslint-env mocha */
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHeliaHTTP } from '../src/index.js'
import { createDag, type DAGNode } from './fixtures/create-dag.js'
import { dagWalker } from './fixtures/dag-walker.js'
import type { HeliaHTTP } from '@helia/interface/http'

describe('pins (recursive)', () => {
  let heliaHTTP: HeliaHTTP
  let dag: Record<string, DAGNode>

  beforeEach(async () => {
    const blockstore = new MemoryBlockstore()

    // arbitrary CID codec value
    const codec = 7

    // create a DAG, two levels deep with each level having three children
    dag = await createDag(codec, blockstore, 2, 3)

    heliaHTTP = await createHeliaHTTP({
      blockBrokers: [],
      datastore: new MemoryDatastore(),
      blockstore,
      dagWalkers: [
        dagWalker(codec, dag)
      ]
    })
  })

  afterEach(async () => {
    if (heliaHTTP != null) {
      await heliaHTTP.stop()
    }
  })

  it('pins a block recursively', async () => {
    await heliaHTTP.pins.add(dag['level-0'].cid)

    // all sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(heliaHTTP.pins.isPinned(cid)).to.eventually.be.true(`did not pin ${name}`)
      }
    }
  })

  it('unpins recursively', async () => {
    await heliaHTTP.pins.add(dag['level-0'].cid)
    await heliaHTTP.pins.rm(dag['level-0'].cid)

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(heliaHTTP.pins.isPinned(cid)).to.eventually.be.false(`did not unpin ${name}`)
      }
    }
  })

  it('does not delete a pinned sub-block', async () => {
    await heliaHTTP.pins.add(dag['level-0'].cid)

    // no sub blocks should be pinned
    for (const [name, node] of Object.entries(dag)) {
      for (const cid of node.links) {
        await expect(heliaHTTP.blockstore.delete(cid)).to.eventually.be.rejected
          .with.property('message', 'CID was pinned', `allowed deleting pinned block ${name}`)
      }
    }
  })
})
