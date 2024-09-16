import * as dagCbor from '@ipld/dag-cbor'
import { createAndPutBlock } from './create-block.js'
import type { Blockstore } from 'interface-blockstore'
import type { CID } from 'multiformats/cid'

export interface DAGNode {
  cid: CID
  level: number
  links: CID[]
}

/**
 * Creates a DAG for use with the dag walker
 *
 * E.g.
 *
 * ```
 * createDag(..., 2, 3)
 *
 * // creates:
 * {
 *   'level-0': {
 *     level: 0,
 *     cid: CID(baedreibc6d3tr7glrwvflqkvsd7gszrb77kdmhgqukcwx5wnxdnydm3eia),
 *     links: [
 *       CID(baedreicvd6e5yvdg22elvqofvwjtnueennogk24zotw6sbrybrthme7bye),
 *       CID(baedreicv6ufi5msnpsrqz4ziw2ekxgvopedluzhgpp74ukw6ncjtaypwlu),
 *       CID(baedreifc4d4pzuzl6rmlf2vinsjcyfnuixogcqcabv65jqtgkbreu6czdm)
 *     ]
 *   },
 *   'level-0-0': {
 *     level: 1,
 *     cid: CID(baedreicvd6e5yvdg22elvqofvwjtnueennogk24zotw6sbrybrthme7bye),
 *     links: [
 *       CID(baedreifcryimpj7cajld5znmpjis7z5gktwnsjbipbi6zkoe2y634sj5n4),
 *       CID(baedreid375udk75eukd3xms5nqa7fq45uq2m5xddpf6reamgp3356dqvba),
 *       CID(baedreig5ajzof2zotjqjaqloaqren2qc2ytuyalhsbf6e7qtpiwqzjyvsu)
 *     ]
 *   },
 *   'level-0-1': {
 *     level: 1,
 *     cid: CID(baedreicv6ufi5msnpsrqz4ziw2ekxgvopedluzhgpp74ukw6ncjtaypwlu),
 *     links: [
 *       CID(baedreidqugkmpuyh3klk3ediwwltqfuapesi2dr65k2bkyokhrp4m5cuvq),
 *       CID(baedreia75iubjvtv4ukrq2qxs6mwo5iyrmn4273hmkuvlbrsw3wwss2zwe),
 *       CID(baedreibjyashtb6wj4inxvcfmsqbsfm5s375524fqo4liw3cshcmu2x7ma)
 *     ]
 *   },
 *   'level-0-2': {
 *     level: 1,
 *     cid: CID(baedreifc4d4pzuzl6rmlf2vinsjcyfnuixogcqcabv65jqtgkbreu6czdm),
 *     links: [
 *       CID(baedreibfll7pocwwxysan5yprzywx277zzimmhwqdgrvs7bx3oujqd4xpa),
 *       CID(baedreig5rrihh454f4qcef476m42aughuz5hf4rcc72damlz6okxdafpxe),
 *       CID(baedreigytohidtspknvirjkslrox23g3qmye5mrx2wijn6ykrpthyg2kry)
 *     ]
 *   }
 * }
 * ```
 */
export async function createDag (blocks: Blockstore, depth: number, children: number): Promise<Record<string, DAGNode>> {
  const dag: Record<string, DAGNode> = {}

  interface Parent {
    name: string
    depth: number
    links: Parent[]
  }

  async function descend (parent: Parent, level: number): Promise<void> {
    if (level === -1) {
      return
    }

    for (let i = 0; i < children; i++) {
      const node: Parent = {
        name: `${parent.name}-${i}`,
        depth: depth - level,
        links: []
      }

      parent.links.push(node)

      await descend(node, level - 1)
    }
  }

  const node: Parent = {
    name: 'level-0',
    depth: 0,
    links: []
  }

  await descend(node, depth - 1)

  async function write (parent: Parent): Promise<void> {
    const links: CID[] = []

    for (const child of parent.links) {
      if (child.links.length > 0) {
        await write(child)
      }

      links.push(
        await createAndPutBlock(dagCbor.code, dagCbor.encode(child), blocks)
      )
    }

    // @ts-expect-error changing type
    parent.links = links

    const cid = await createAndPutBlock(dagCbor.code, dagCbor.encode(parent), blocks)

    dag[parent.name] = {
      cid,
      level: parent.depth,
      links
    }
  }

  await write(node)

  return dag
}
