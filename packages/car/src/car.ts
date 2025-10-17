import { CarWriter } from '@ipld/car'
import drain from 'it-drain'
import map from 'it-map'
import { raceSignal } from 'race-signal'
import { DAG_PB_CODEC_CODE } from './constants.ts'
import { SubgraphExporter } from './export-strategies/subgraph-exporter.js'
import { UnixFSExporter } from './index.js'
import type { CarComponents, Car as CarInterface, ExportCarOptions } from './index.js'
import type { PutManyBlocksProgressEvents } from '@helia/interface/blocks'
import type { CarReader } from '@ipld/car'
import type { AbortOptions, Logger } from '@libp2p/interface'
import type { CID } from 'multiformats/cid'
import type { ProgressOptions } from 'progress-events'

export class Car implements CarInterface {
  private readonly components: CarComponents
  private readonly log: Logger

  constructor (components: CarComponents) {
    this.components = components
    this.log = components.logger.forComponent('helia:car')
  }

  async import (reader: Pick<CarReader, 'blocks'>, options?: AbortOptions & ProgressOptions<PutManyBlocksProgressEvents>): Promise<void> {
    await drain(this.components.blockstore.putMany(
      map(reader.blocks(), ({ cid, bytes }) => ({ cid, bytes })),
      options
    ))
  }

  async * export (root: CID | CID[], options?: ExportCarOptions): AsyncGenerator<Uint8Array, void, undefined> {
    const { writer, out } = CarWriter.create(root)
    const iter = out[Symbol.asyncIterator]()
    const controller = new AbortController()

    // has to be done async so we write to `writer` and read from `out` at the
    // same time
    this._export(root, writer, options)
      .catch((err) => {
        this.log.error('error during streaming export - %e', err)
        controller.abort(err)
      })

    while (true) {
      const { done, value } = await raceSignal(iter.next(), controller.signal)

      // the writer's `out` iterable can yield results synchronously, in which
      // case the controller may have been aborted but the event may not have
      // fired yet so check the signal status manually before processing the
      // next iterable result
      if (controller.signal.aborted) {
        throw controller.signal.reason
      }

      if (value != null) {
        yield value
      }

      if (done === true) {
        break
      }
    }
  }

  private async _export (root: CID | CID[], writer: Pick<CarWriter, 'put' | 'close'>, options?: ExportCarOptions): Promise<void> {
    const roots = Array.isArray(root) ? root : [root]
    const traversalStrategy = options?.traversal

    for (const root of roots) {
      const exportStrategy = options?.exporter ?? (root.code === DAG_PB_CODEC_CODE ? new UnixFSExporter() : new SubgraphExporter())
      let current = root
      let underRoot = false

      if (traversalStrategy != null) {
        for await (const { cid, bytes } of traversalStrategy.traverse(current, this.components.blockstore, this.components.getCodec, options)) {
          this.log.trace('next CID on path to %c is %c', root, cid)
          current = cid

          // the traversal is under the root we are exporting
          if (root.equals(cid)) {
            underRoot = true
          }

          // include the traversal block if we are under the root CID or it has
          // been explicitly requested
          if (underRoot || options?.includeTraversalBlocks === true) {
            // eslint-disable-next-line max-depth
            if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
              continue
            }

            // mark as processed
            options?.blockFilter?.add(cid.multihash.bytes)

            // store block on path to target
            await writer.put({
              cid,
              bytes
            })
          }
        }
      }

      for await (const { cid, bytes } of exportStrategy.export(current, this.components.blockstore, this.components.getCodec, options)) {
        if (options?.blockFilter?.has(cid.multihash.bytes) === true) {
          continue
        }

        // skip the export target block if we have already included it during
        // traversal
        if (underRoot && cid.equals(current)) {
          continue
        }

        // mark as processed
        options?.blockFilter?.add(cid.multihash.bytes)

        // write to CAR
        await writer.put({
          cid,
          bytes
        })
      }
    }

    // wait for the writer to end
    await writer.close()
  }
}
