/* eslint-disable no-console */

import { unixfs } from '@helia/unixfs'
import { multiaddr } from '@multiformats/multiaddr'
import drain from 'it-drain'
import { CID } from 'multiformats'
import { getHelia } from './get-helia.js'

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`

const cid = CID.parse(`${process.env.HELIA_CID}`)
const mas = `${process.env.HELIA_MULTIADDRS}`.split(',').map(str => multiaddr(str))
const signal = AbortSignal.timeout(parseInt(process.env.HELIA_TIMEOUT ?? '60000'))

try {
  const helia = await getHelia()

  await helia.libp2p.dial(mas, {
    signal
  })

  const fs = unixfs(helia)
  const start = Date.now()

  await drain(fs.cat(cid, {
    signal
  }))

  console.info(`TEST-OUTPUT:${Date.now() - start}`)
} catch {
  console.info('TEST-OUTPUT:?')
}

console.info('TEST-OUTPUT:done')
