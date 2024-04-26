import { CID } from 'multiformats'
import { multiaddr } from '@multiformats/multiaddr'
import { getKubo } from './get-kubo.js'

process.title = `helia transport benchmark ${process.env.HELIA_TYPE}`

const cid = CID.parse(`${process.env.HELIA_CID}`)
const mas = `${process.env.HELIA_MULTIADDRS}`.split(',').map(str => multiaddr(str))

const kubo = await getKubo()

await Promise.all(
  mas.map(async ma => kubo.api.swarm.connect(ma))
)

const start = Date.now()

// pull data from remote
await kubo.api.pin.add(cid, {
  recursive: true
})

console.info(`TEST-OUTPUT:${Date.now() - start}`)
console.info('TEST-OUTPUT:done')
