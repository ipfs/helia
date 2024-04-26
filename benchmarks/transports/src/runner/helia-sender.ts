import { unixfs } from '@helia/unixfs'
import { getHelia } from './get-helia.js'
import { fixedSize } from 'ipfs-unixfs-importer/chunker'
import { balanced } from 'ipfs-unixfs-importer/layout'
import bufferStream from 'it-buffer-stream'

interface ImportOptions {
  cidVersion?: 0 | 1
  rawLeaves?: boolean
  chunkSize?: number
  maxChildrenPerNode?: number
}

const options: ImportOptions = JSON.parse(`${process.env.HELIA_IMPORT_OPTIONS}`)
const size = Number(`${process.env.HELIA_FILE_SIZE}`)

const helia = await getHelia()
const fs = unixfs(helia)

const cid = await fs.addByteStream(bufferStream(size), {
  ...options,
  chunker: options.chunkSize != null ? fixedSize({ chunkSize: options.chunkSize }) : undefined,
  layout: options.maxChildrenPerNode != null ? balanced({ maxChildrenPerNode: options.maxChildrenPerNode }) : undefined
})

console.info(`TEST-OUTPUT:${JSON.stringify({
  cid: cid.toString(),
  multiaddrs: helia.libp2p.getMultiaddrs().map(ma => ma.toString()).join(',')
})}`)
