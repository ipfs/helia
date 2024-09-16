import { unixfs } from '@helia/unixfs'
import * as dagPB from '@ipld/dag-pb'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import { createNode } from 'ipfsd-ctl'
import drain from 'it-drain'
import { path as kuboPath } from 'kubo'
import { create as kuboRpcClient, type BlockPutOptions } from 'kubo-rpc-client'
import * as raw from 'multiformats/codecs/raw'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import type { ImportOptions, TransferBenchmark } from './index.js'

const FORMAT_LOOKUP: Record<number, string> = {
  [dagPB.code]: 'dag-pb',
  [raw.code]: 'raw'
}

export async function createKuboBenchmark (): Promise<TransferBenchmark> {
  const controller = await createNode({
    type: 'kubo',
    test: true,
    bin: kuboPath(),
    rpc: kuboRpcClient,
    init: {
      emptyRepo: true
    }
  })

  return {
    async teardown () {
      await controller.stop()
    },
    async addr () {
      const id = await controller.api.id()

      return id.addresses[0]
    },
    async dial (ma) {
      await controller.api.swarm.connect(ma)
    },
    async add (content, options: ImportOptions) {
      // use Helia's UnixFS tooling to create the DAG otherwise we are limited
      // to 1MB block sizes
      const fs = unixfs({
        blockstore: {
          async get (cid, options = {}) {
            return controller.api.block.get(cid, options)
          },
          async put (cid, block, options = {}) {
            const opts: BlockPutOptions = {
              allowBigBlock: true
            }

            if (cid.version === 1) {
              opts.version = 1
              opts.format = FORMAT_LOOKUP[cid.code]
            }

            const putCid = await controller.api.block.put(block, opts)

            if (!uint8ArrayEquals(cid.multihash.bytes, putCid.multihash.bytes)) {
              throw new Error(`Put failed ${putCid} != ${cid}`)
            }

            return cid
          },
          async has (cid, options = {}) {
            try {
              await controller.api.block.get(cid, options)
              return true
            } catch {
              return false
            }
          }
        }
      })

      return fs.addByteStream(content, {
        ...options,
        chunker: options.chunkSize != null ? fixedSize({ chunkSize: options.chunkSize }) : undefined,
        layout: options.maxChildrenPerNode != null ? balanced({ maxChildrenPerNode: options.maxChildrenPerNode }) : undefined
      })
    },
    async get (cid) {
      await drain(controller.api.cat(cid))
    }
  }
}
