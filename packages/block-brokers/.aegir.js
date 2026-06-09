import { CarWriter } from '@ipld/car'
import cors from 'cors'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import polka from 'polka'

/**
 * Fixed raw blocks used by the CAR-stream session tests. The test recomputes
 * these from the same bytes, so the CIDs match without passing them around.
 */
const CAR_BLOCK_BYTES = [
  Uint8Array.from([1, 2, 3, 4]),
  Uint8Array.from([5, 6, 7, 8]),
  Uint8Array.from([9, 10, 11, 12])
]

async function makeRawBlock (bytes) {
  return { cid: CID.createV1(raw.code, await sha256.digest(bytes)), bytes }
}

async function buildCar (blocks, roots) {
  const { writer, out } = CarWriter.create(roots)
  const chunks = []
  const collecting = (async () => {
    for await (const chunk of out) {
      chunks.push(chunk)
    }
  })()
  for (const block of blocks) {
    await writer.put(block)
  }
  await writer.close()
  await collecting
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const car = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    car.set(chunk, offset)
    offset += chunk.length
  }
  return car
}


/**
 * Middleware to log requests
 */
const requestLogs = []
let enableLogs = false
function logRequests(req, res, next) {
  if (!req.url.includes('/logs') && enableLogs) {
    requestLogs.push({
      method: req.method,
      url: req.url,
      headers: req.headers
    })
  }
  next()
}

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    async before () {
      const goodGateway = polka({
        port: 0,
        host: '127.0.0.1'
      })
      goodGateway.use(cors())
      goodGateway.use(logRequests)
      goodGateway.all('/ipfs/bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq', (req, res) => {
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': 4
        })
        res.end(Uint8Array.from([0, 1, 2, 0]))
      })
      goodGateway.all('/ipfs/bafkqabtimvwgy3yk', async (req, res) => {
        // delay the response
        await new Promise((resolve) => setTimeout(resolve, 500))

        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': 5
        })
        // "hello"
        res.end(Uint8Array.from([104, 101, 108, 108, 111]))
      })

      goodGateway.all('/ipfs/*', (req, res) => {
        // succeeds with empty block for any other CID
        res.writeHead(200)
        res.end(Uint8Array.from([]))
      })

      goodGateway.all('/logs', (req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(requestLogs))
      })
      goodGateway.all('/logs/enable', (req, res) => {
        enableLogs = true
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'Logging enabled' }))
      })
      goodGateway.all('/logs/disable', (req, res) => {
        enableLogs = false
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'Logging disabled' }))
      })
      goodGateway.all('/logs/clear', (req, res) => {
        requestLogs.length = 0
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ message: 'Logs cleared' }))
      })

      await goodGateway.listen()
      const { port: goodGatewayPort } = goodGateway.server.address()

      const badGateway = polka({
        port: 0,
        host: '127.0.0.1'
      })
      badGateway.use(cors())
      badGateway.all('/ipfs/bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq', (req, res) => {
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': 4
        })
        // fails validation
        res.end(Uint8Array.from([0, 1, 2, 1]))
      })

      badGateway.all('/ipfs/*', (req, res) => {
        // fails
        res.writeHead(500)
        res.end()
      })

      await badGateway.listen()
      const { port: badGatewayPort } = badGateway.server.address()

      // Gateway that serves a CAR of a small DAG, plus the raw blocks. The CAR
      // contains the root and the first leaf but NOT the second leaf, so the
      // session must gap-fill that one over ?format=raw.
      const blocks = await Promise.all(CAR_BLOCK_BYTES.map(makeRawBlock))
      const carBytes = await buildCar([blocks[0], blocks[1]], [blocks[0].cid])
      const blockByCid = new Map(blocks.map(b => [b.cid.toString(), b.bytes]))
      let carRequests = 0

      const carGateway = polka({ port: 0, host: '127.0.0.1' })
      carGateway.use(cors())
      carGateway.all('/car-requests', (req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ carRequests }))
      })
      carGateway.all('/ipfs/:cid', (req, res) => {
        // no-store so the browser HTTP cache does not satisfy getCar's
        // `cache: 'force-cache'` across tests, which would hide CAR requests
        // from the counter below.
        const format = new URL(req.url, 'http://localhost').searchParams.get('format')
        if (format === 'car') {
          carRequests++
          res.writeHead(200, { 'content-type': 'application/vnd.ipld.car', 'cache-control': 'no-store' })
          res.end(carBytes)
          return
        }
        const bytes = blockByCid.get(req.params.cid)
        if (bytes == null) {
          res.writeHead(404)
          res.end()
          return
        }
        res.writeHead(200, { 'content-type': 'application/vnd.ipld.raw', 'content-length': bytes.length, 'cache-control': 'no-store' })
        res.end(bytes)
      })

      await carGateway.listen()
      const { port: carGatewayPort } = carGateway.server.address()

      return {
        goodGateway,
        badGateway,
        carGateway,
        env: {
          TRUSTLESS_GATEWAY: `http://127.0.0.1:${goodGatewayPort}`,
          BAD_TRUSTLESS_GATEWAY: `http://127.0.0.1:${badGatewayPort}`,
          CAR_GATEWAY: `http://127.0.0.1:${carGatewayPort}`
        }
      }
    },
    async after (options, before) {
      await before.goodGateway.server.close()
      await before.badGateway.server.close()
      await before.carGateway.server.close()
    }
  }
}

export default options
