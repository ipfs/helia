import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import type { DAGNode } from './create-dag.js'
import type { DAGWalker } from '../../src/index.js'

export function dagWalker (codec: number, dag: Record<string, DAGNode>): DAGWalker {
  return {
    codec,
    async * walk (block) {
      const node = dag[uint8ArrayToString(block)] ?? { links: [] }

      yield * node.links
    }
  }
}
