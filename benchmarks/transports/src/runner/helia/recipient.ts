/* eslint-disable no-console */

import { unixfs } from '@helia/unixfs'
import { multiaddr } from '@multiformats/multiaddr'
import drain from 'it-drain'
import { CID } from 'multiformats'
import { getHelia } from './get-helia.js'

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
