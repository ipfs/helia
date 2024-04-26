import { unixfs } from '@helia/unixfs'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import bufferStream from 'it-buffer-stream'
import * as dagPB from '@ipld/dag-pb'
import * as raw from 'multiformats/codecs/raw'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { getKubo } from './get-kubo.js'
import type { BlockPutOptions } from 'kubo-rpc-client'

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`

const FORMAT_LOOKUP: Record<number, string> = {
  [dagPB.code]: 'dag-pb',
  [raw.code]: 'raw'
}

interface ImportOptions {
  cidVersion?: 0 | 1
  rawLeaves?: boolean
  chunkSize?: number
  maxChildrenPerNode?: number
}

const options: ImportOptions = JSON.parse(`${process.env.HELIA_IMPORT_OPTIONS}`)
const size = Number(`${process.env.HELIA_FILE_SIZE}`)

const kubo = await getKubo()

// use Helia's UnixFS tooling to create the DAG otherwise we are limited
// to 1MB block sizes
const fs = unixfs({
  blockstore: {
    async get (cid, options = {}) {
      return kubo.api.block.get(cid, options)
    },
    async put (cid, block, options = {}) {
      const opts: BlockPutOptions = {
        allowBigBlock: true
      }

      if (cid.version === 1) {
        opts.version = 1
        opts.format = FORMAT_LOOKUP[cid.code]
      }

      const putCid = await kubo.api.block.put(block, opts)

      if (!uint8ArrayEquals(cid.multihash.bytes, putCid.multihash.bytes)) {
        throw new Error(`Put failed ${putCid} != ${cid}`)
      }

      return cid
    },
    async has (cid, options = {}) {
      try {
        await kubo.api.block.get(cid, options)
        return true
      } catch {
        return false
      }
    }
  }
})

const cid = await fs.addByteStream(bufferStream(size), {
  ...options,
  chunker: options.chunkSize != null ? fixedSize({ chunkSize: options.chunkSize }) : undefined,
  layout: options.maxChildrenPerNode != null ? balanced({ maxChildrenPerNode: options.maxChildrenPerNode }) : undefined
})

console.info(`TEST-OUTPUT:${JSON.stringify({
  cid: cid.toString(),
  multiaddrs: (await kubo.api.id()).addresses.map(ma => ma.toString()).join(',')
})}`)
