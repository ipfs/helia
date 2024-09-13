/* eslint-env mocha */
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import drain from 'it-drain'
import { createDag, type DAGNode } from './fixtures/create-dag.js'
import { createHelia } from './fixtures/create-helia.js'
import type { Helia } from '@helia/interface'

const MAX_DEPTH = 3

describe('pins (depth limited)', () => {
  let helia: Helia
  let dag: Record<string, DAGNode>

  beforeEach(async () => {
    const blockstore = new MemoryBlockstore()

    // create a DAG, MAX_DEPTH levels deep with each level having three children
    dag = await createDag(blockstore, MAX_DEPTH, 3)

    helia = await createHelia({
      blockstore,
      blockBrokers: []
    })
  })

  afterEach(async () => {
    if (helia != null) {
      await helia.stop()
    }
  })

  for (let i = 0; i < MAX_DEPTH; i++) {
    describe(`depth ${i}`, () => { // eslint-disable-line no-loop-func
      it(`pins a block to depth ${i}`, async () => {
        await drain(helia.pins.add(dag['level-0'].cid, {
          depth: i
        }))

        // only root block should be pinned
        for (const [name, node] of Object.entries(dag)) {
          if (node.level <= i) {
            await expect(helia.pins.isPinned(node.cid)).to.eventually.be.true(`did not pin ${name}`)
          } else {
            await expect(helia.pins.isPinned(node.cid)).to.eventually.be.false(`pinned ${name}`)
          }

          if (node.level > i) {
            // no children of this node should be pinned
            for (const cid of node.links) {
              await expect(helia.pins.isPinned(cid)).to.eventually.be.false(`pinned ${name}`)
            }
          }
        }
      })

      it(`unpins to depth ${i}`, async () => {
        await drain(helia.pins.add(dag['level-0'].cid, {
          depth: i
        }))
        await drain(helia.pins.rm(dag['level-0'].cid))

        // no blocks should be pinned
        for (const [name, node] of Object.entries(dag)) {
          for (const cid of node.links) {
            await expect(helia.pins.isPinned(cid)).to.eventually.be.false(`did not unpin ${name}`)
          }
        }
      })

      it(`does not delete a pinned sub-block under level ${i}`, async () => {
        await drain(helia.pins.add(dag['level-0'].cid, {
          depth: i
        }))

        // no sub blocks should be pinned
        for (const [name, node] of Object.entries(dag)) {
          if (node.level <= i) {
            await expect(helia.blockstore.delete(node.cid)).to.eventually.be.rejected
              .with.property('message', 'CID was pinned', `allowed deleting pinned block ${name}`)
          } else {
            await expect(helia.blockstore.delete(node.cid)).to.eventually.be.undefined(`allowed deleting pinned block ${name}`)
          }

          if (node.level > i) {
            // no children of this node should be pinned
            for (const cid of node.links) {
              await expect(helia.blockstore.delete(cid)).to.eventually.be.undefined(`allowed deleting pinned block ${name}`)
            }
          }
        }
      })
    })
  }
})
