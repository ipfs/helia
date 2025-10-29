import * as dagCbor from '@ipld/dag-cbor'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import all from 'it-all'
import map from 'it-map'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { breadthFirstWalker, depthFirstWalker } from '../src/graph-walker.ts'
import type { CodecLoader } from '@helia/interface'
import type { Blockstore } from 'interface-blockstore'

interface Node {
  name: string
  children?: CID[]
}

interface Child {
  cid: CID,
  buf: Uint8Array
  obj: any
}

async function createNode (obj: any, blockstore: Blockstore): Promise<Child> {
  const buf = dagCbor.encode(obj)
  const hash = await sha256.digest(buf)
  const cid = CID.createV1(dagCbor.code, hash)

  await blockstore.put(cid, buf)

  return {
    cid,
    buf,
    obj
  }
}

describe('graph-walker', () => {
  let blockstore: Blockstore
  let nodes: Record<string, Child>
  let getCodec: CodecLoader

  beforeEach(async () => {
    blockstore = new MemoryBlockstore()
    getCodec = (): any => dagCbor

    // create a graph:
    // root
    //   -> a
    //      -> d
    //      -> e
    //      -> f
    //   -> b
    //      -> g
    //      -> h
    //      -> i
    //   -> c
    //      -> j
    //      -> k
    //      -> l

    nodes = {}

    for (const name of ['d', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) {
      nodes[name] = await createNode({
        name
      }, blockstore)
    }

    nodes.a = await createNode({
      name: 'a',
      children: [
        nodes.d.cid,
        nodes.e.cid,
        nodes.f.cid
      ]
    }, blockstore)

    nodes.b = await createNode({
      name: 'b',
      children: [
        nodes.g.cid,
        nodes.h.cid,
        nodes.i.cid
      ]
    }, blockstore)

    nodes.c = await createNode({
      name: 'c',
      children: [
        nodes.j.cid,
        nodes.k.cid,
        nodes.l.cid
      ]
    }, blockstore)

    nodes.root = await createNode({
      name: 'root',
      children: [
        nodes.a.cid,
        nodes.b.cid,
        nodes.c.cid
      ]
    }, blockstore)
  })

  describe('depth-first', () => {
    it('should walk depth-first', async () => {
      const walker = depthFirstWalker({
        blockstore,
        getCodec
      })

      const result = await all(map(walker.walk(nodes.root.cid), (node) => {
        const obj = dagCbor.decode<Node>(node.block.bytes)

        return obj.name
      }))

      expect(result).to.deep.equal([
        'root', 'a', 'd', 'e', 'f', 'b', 'g', 'h', 'i', 'c', 'j', 'k', 'l'
      ])
    })

    it('should filter children', async () => {
      const walker = depthFirstWalker({
        blockstore,
        getCodec
      })

      const result = await all(map(walker.walk(nodes.root.cid, {
        includeChild (child, parent) {
          return parent.value.name === 'root' || parent.value.name === 'a'
        }
      }), (node) => {
        const obj = dagCbor.decode<Node>(node.block.bytes)

        return obj.name
      }))

      expect(result).to.deep.equal([
        'root', 'a', 'd', 'e', 'f', 'b', 'c'
      ])
    })
  })

  describe('breadth-first', () => {
    it('should walk breadth-first', async () => {
      const walker = breadthFirstWalker({
        blockstore,
        getCodec
      })

      const result = await all(map(walker.walk(nodes.root.cid), (node) => {
        const obj = dagCbor.decode<Node>(node.block.bytes)

        return obj.name
      }))

      expect(result).to.deep.equal([
        'root', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'
      ])
    })

    it('should filter children', async () => {
      const walker = breadthFirstWalker({
        blockstore,
        getCodec
      })

      const result = await all(map(walker.walk(nodes.root.cid, {
        includeChild (child, parent) {
          return parent.value.name === 'root' || parent.value.name === 'a'
        }
      }), (node) => {
        const obj = dagCbor.decode<Node>(node.block.bytes)

        return obj.name
      }))

      expect(result).to.deep.equal([
        'root', 'a', 'b', 'c', 'd', 'e', 'f'
      ])
    })
  })
})
