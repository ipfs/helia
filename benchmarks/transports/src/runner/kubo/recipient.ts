/* eslint-disable no-console */

import { multiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats'
import { getKubo } from './get-kubo.js'

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`

const cid = CID.parse(`${process.env.HELIA_CID}`)
const mas = `${process.env.HELIA_MULTIADDRS}`.split(',').map(str => multiaddr(str))

const kubo = await getKubo()

await Promise.all(
  mas.map(async ma => kubo.api.swarm.connect(ma))
)

const start = Date.now()

try {
  // pull data from remote. this is going over HTTP so use pin in order to ensure
  // the data is loaded by Kubo but don't skew the benchmark by then also
  // streaming it to the client
  await kubo.api.pin.add(cid, {
    recursive: true,
    signal: AbortSignal.timeout(parseInt(process.env.HELIA_TIMEOUT ?? '60000'))
  })

  console.info(`TEST-OUTPUT:${Date.now() - start}`)
  console.info('TEST-OUTPUT:done')
} catch {
  console.info(`TEST-OUTPUT:?`)
  console.info('TEST-OUTPUT:done')
}

console.info(`TEST-OUTPUT:${Date.now() - start}`)
console.info('TEST-OUTPUT:done')
