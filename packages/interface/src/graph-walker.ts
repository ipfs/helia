import type { Blockstore } from 'interface-blockstore'
import type { AbortOptions } from '@libp2p/interface'
import type { BlockView, CID, Version } from 'multiformats'
import type { CodecLoader } from './index.js'

export interface GraphWalkerComponents {
  blockstore: Blockstore
  getCodec: CodecLoader
}

export interface GraphWalkerInit {}

export interface GraphNode<
  T = unknown,
  C extends number = number,
  A extends number = number,
  V extends Version = 0 | 1
> {
  block: BlockView<T, C, A, V>
  depth: number
  path: CID[]
}

export interface WalkOptions<T> extends AbortOptions {
  /**
   * Stop traversal once `node.depth` reaches this value. The root is
   * depth 0. Default: Infinity (walk the entire DAG).
   */
  depth?: number

  includeChild?(child: CID, parent: BlockView<T, number, number, 0 | 1>): boolean
}

export interface GraphWalker {
  walk<T = any>(cid: CID, options?: WalkOptions<T>): AsyncGenerator<GraphNode<T>>
}

export type GraphWalkerFactory = (components: GraphWalkerComponents) => GraphWalker
