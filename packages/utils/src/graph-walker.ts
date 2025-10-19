import { Queue } from '@libp2p/utils'
import filter from 'it-filter'
import toBuffer from 'it-to-buffer'
import { createUnsafe } from 'multiformats/block'
import type { CodecLoader } from '@helia/interface'
import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from 'interface-store'
import type { BlockView, CID, Version } from 'multiformats'

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

abstract class AbstractGraphWalker {
  private readonly components: GraphWalkerComponents

  constructor (components: GraphWalkerComponents, init: GraphWalkerInit) {
    this.components = components
  }

  async * walk <T = any> (cid: CID, options?: AbortOptions): AsyncGenerator<GraphNode<T>> {
    const queue = this.getQueue()
    const gen = filter(queue.toGenerator(options), (node) => node != null) as AsyncGenerator<GraphNode<T>>
    let finished = false

    const job = async (options: JobOptions): Promise<GraphNode<T> | undefined> => {
      const cid = options.cid
      const bytes = await toBuffer(this.components.blockstore.get(cid, options))
      const block = createUnsafe<T, number, number, 0 | 1>({
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
          // eslint-disable-next-line no-loop-func
          .catch(err => {
            // only throw if the generator is still yielding results, otherwise
            // it can cause unhandled promise rejections
            if (!finished) {
              gen.throw(err)
            }
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
        // only throw if the generator is still yielding results, otherwise it
        // can cause unhandled promise rejections
        if (!finished) {
          gen.throw(err)
        }
      })

    try {
      yield * gen
    } finally {
      finished = true
      // abort any in-progress operations
      queue.abort()
    }
  }

  abstract getQueue <T> (): Queue<GraphNode<T> | undefined, JobOptions>
}

class DepthFirstGraphWalker extends AbstractGraphWalker {
  getQueue<T>(): Queue<GraphNode<T> | undefined, JobOptions> {
    return new Queue<GraphNode<T> | undefined, JobOptions>({
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
  }
}

class BreadthFirstGraphWalker extends AbstractGraphWalker {
  getQueue<T>(): Queue<GraphNode<T> | undefined, JobOptions> {
    return new Queue<GraphNode<T> | undefined, JobOptions>({
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
  }
}
