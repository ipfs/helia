/* eslint-env mocha */
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { MemoryDatastore } from 'datastore-core'
import { createHeliaHTTP } from '../src/index.js'
import { createDag, type DAGNode } from './fixtures/create-dag.js'
import { dagWalker } from './fixtures/dag-walker.js'
import type { HeliaHTTP } from '@helia/interface/http'

const MAX_DEPTH = 3

describe('pins (depth limited)', () => {
  let heliaHTTP: HeliaHTTP
  let dag: Record<string, DAGNode>

  beforeEach(async () => {
    const blockstore = new MemoryBlockstore()

    // arbitrary CID codec value
    const codec = 7

    // create a DAG, MAX_DEPTH levels deep with each level having three children
    dag = await createDag(codec, blockstore, MAX_DEPTH, 3)

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

  for (let i = 0; i < MAX_DEPTH; i++) {
    describe(`depth ${i}`, () => { // eslint-disable-line no-loop-func
      it(`pins a block to depth ${i}`, async () => {
        await heliaHTTP.pins.add(dag['level-0'].cid, {
          depth: i
        })

        // only root block should be pinned
        for (const [name, node] of Object.entries(dag)) {
          if (node.level <= i) {
            await expect(heliaHTTP.pins.isPinned(node.cid)).to.eventually.be.true(`did not pin ${name}`)
          } else {
            await expect(heliaHTTP.pins.isPinned(node.cid)).to.eventually.be.false(`pinned ${name}`)
          }

          if (node.level > i) {
            // no children of this node should be pinned
            for (const cid of node.links) {
              await expect(heliaHTTP.pins.isPinned(cid)).to.eventually.be.false(`pinned ${name}`)
            }
          }
        }
      })

      it(`unpins to depth ${i}`, async () => {
        await heliaHTTP.pins.add(dag['level-0'].cid, {
          depth: i
        })
        await heliaHTTP.pins.rm(dag['level-0'].cid)

        // no blocks should be pinned
        for (const [name, node] of Object.entries(dag)) {
          for (const cid of node.links) {
            await expect(heliaHTTP.pins.isPinned(cid)).to.eventually.be.false(`did not unpin ${name}`)
          }
        }
      })

      it(`does not delete a pinned sub-block under level ${i}`, async () => {
        await heliaHTTP.pins.add(dag['level-0'].cid, {
          depth: i
        })

        // no sub blocks should be pinned
        for (const [name, node] of Object.entries(dag)) {
          if (node.level <= i) {
            await expect(heliaHTTP.blockstore.delete(node.cid)).to.eventually.be.rejected
              .with.property('message', 'CID was pinned', `allowed deleting pinned block ${name}`)
          } else {
            await expect(heliaHTTP.blockstore.delete(node.cid)).to.eventually.be.undefined(`allowed deleting pinned block ${name}`)
          }

          if (node.level > i) {
            // no children of this node should be pinned
            for (const cid of node.links) {
              await expect(heliaHTTP.blockstore.delete(cid)).to.eventually.be.undefined(`allowed deleting pinned block ${name}`)
            }
          }
        }
      })
    })
  }
})
