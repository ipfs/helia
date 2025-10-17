import type { CodecLoader } from "@helia/interface"
import { Queue } from "@libp2p/utils"
import type { Blockstore } from "interface-blockstore"
import type { AbortOptions } from "interface-store"
import toBuffer from "it-to-buffer"
import type { BlockView, CID, Version } from "multiformats"
import { createUnsafe } from "multiformats/block"

export interface GraphWalkerComponents {
  blockstore: Blockstore
  getCodec: CodecLoader
}

export interface GraphWalkerInit {

}

export interface GraphNode <T = unknown, C extends number = number, A extends number = number, V extends Version = 0 | 1> {
  block: BlockView<T, C, A, V>
  depth: number
  path: CID[]
}

export interface GraphWalker {
  walk <T = any> (cid: CID, options?: AbortOptions): AsyncGenerator<GraphNode<T>>
}

export function depthFirstWalker (components: GraphWalkerComponents, init: GraphWalkerInit = {}): GraphWalker {
  return new DepthFirstGraphWalker(components, init)
}

export function breadthFirstWalker (components: GraphWalkerComponents, init: GraphWalkerInit = {}): GraphWalker {
  return new BreadthFirstGraphWalker(components, init)
}

interface JobOptions extends AbortOptions {
  cid: CID
  depth: number
  path: CID[]
}

class DepthFirstGraphWalker {
  private readonly components: GraphWalkerComponents

  constructor (components: GraphWalkerComponents, init: GraphWalkerInit = {}) {
    this.components = components
  }

  async * walk <T = any> (cid: CID, options: AbortOptions) {
    const queue = new Queue<GraphNode<T>, JobOptions>({
      concurrency: 1,
      sort: (a, b) => {
        if (a.options.depth === b.options.depth) {
          return 0
        }

        if (a.options.depth < b.options.depth) {
          return 1
        }

        return -1
      }
    })

    const gen = queue.toGenerator()

    const job = async (options: JobOptions): Promise<GraphNode<T>> => {
      const cid = options.cid
      const bytes = await toBuffer(this.components.blockstore.get(cid, options))
      const block = createUnsafe({
        cid,
        bytes,
        codec: await this.components.getCodec(cid.code)
      })

      for (const [, linkedCid] of block.links()) {
        queue.add(job, {
          ...options,
          cid: linkedCid,
          depth: options.depth + 1,
          path: [...options.path, linkedCid]
        })
          .catch(err => {
            gen.throw(err)
            queue.abort()
          })
      }

      return {
        block,
        depth: options.depth,
        path: options.path
      }
    }

    queue.add(job, {
      ...options,
      cid,
      depth: 0,
      path: [cid]
    })
      .catch(err => {
        gen.throw(err)
        queue.abort()
      })

    yield * gen
  }
}

class BreadthFirstGraphWalker {
  private readonly components: GraphWalkerComponents

  constructor (components: GraphWalkerComponents, init: GraphWalkerInit = {}) {
    this.components = components
  }

  async * walk <T = any> (cid: CID, options: AbortOptions) {
    const queue = new Queue<GraphNode<T>, JobOptions>({
      concurrency: 1,
      sort: (a, b) => {
        if (a.options.depth === b.options.depth) {
          return 0
        }

        if (a.options.depth < b.options.depth) {
          return -1
        }

        return 1
      }
    })

    const gen = queue.toGenerator()

    const job = async (options: JobOptions): Promise<GraphNode<T>> => {
      const cid = options.cid
      const bytes = await toBuffer(this.components.blockstore.get(cid, options))
      const block = createUnsafe({
        cid,
        bytes,
        codec: await this.components.getCodec(cid.code)
      })

      for (const [, linkedCid] of block.links()) {
        queue.add(job, {
          ...options,
          cid: linkedCid,
          depth: options.depth + 1,
          path: [...options.path, linkedCid]
        })
          .catch(err => {
            gen.throw(err)
            queue.abort()
          })
      }

      return {
        block,
        depth: options.depth,
        path: options.path
      }
    }

    queue.add(job, {
      ...options,
      cid,
      depth: 0,
      path: [cid]
    })
      .catch(err => {
        gen.throw(err)
        queue.abort()
      })

    yield * gen
  }
}
