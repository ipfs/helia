import cors from 'cors'
import polka from 'polka'


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

      goodGateway.all('/ipfs/bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq', async (req, res) => {
        // if 'delay' header is set, delay the response
        const delay = req.headers['delay']
        if (delay) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': 4
          })
          res.end(Uint8Array.from([0, 1, 2, 0]))
        } else {
          // no reason to use this in tests without the delay configured.
          res.writeHead(500, {
            'content-type': 'text/plain',
            'content-length': 13
          })
          res.end('No delay set')
        }
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
      badGateway.all('/ipfs/bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq', (req, res) => {
        // wait for 70 seconds to simulate a slow response. Do not query this cid unless you plan to abort the request.
        // typical test timeout is 60 seconds, so if you reach 60 seconds, there is a bug in handling your abort signal.
        // if you don't reach whatever timeout you set (e.g. `AbortSignal.timeout(1000)`), there is likely a bug in your test.
        const timeoutId = setTimeout(() => {
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': 4
          })
          res.end(Uint8Array.from([0, 1, 2, 1]))
        }, 70000)
        req.on('close', () => {
          clearTimeout(timeoutId)
        })
      })

      badGateway.all('/ipfs/*', (req, res) => {
        // fails
        res.writeHead(500)
        res.end()
      })

      await badGateway.listen()
      const { port: badGatewayPort } = badGateway.server.address()

      return {
        goodGateway,
        badGateway,
        env: {
          TRUSTLESS_GATEWAY: `http://127.0.0.1:${goodGatewayPort}`,
          BAD_TRUSTLESS_GATEWAY: `http://127.0.0.1:${badGatewayPort}`
        }
      }
    },
    async after (options, before) {
      await before.goodGateway.server.close()
      await before.badGateway.server.close()
    }
  }
}

export default options
