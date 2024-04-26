import { getHelia } from './get-helia.js'
import { CID } from 'multiformats'
import drain from 'it-drain'
import { multiaddr } from '@multiformats/multiaddr'
import { unixfs } from '@helia/unixfs'

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`

const cid = CID.parse(`${process.env.HELIA_CID}`)
const mas = `${process.env.HELIA_MULTIADDRS}`.split(',').map(str => multiaddr(str))

const helia = await getHelia()
await helia.libp2p.dial(mas)

const fs = unixfs(helia)

const start = Date.now()

// pull data from remote
await drain(fs.cat(cid))

console.info(`TEST-OUTPUT:${Date.now() - start}`)
console.info('TEST-OUTPUT:done')
