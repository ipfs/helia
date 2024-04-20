import cors from 'cors'
import polka from 'polka'

/** @type {import('aegir').PartialOptions} */
const options = {
  test: {
    async before (options) {
      const server = polka({
        port: 0,
        host: '127.0.0.1'
      })
      server.use(cors())
      server.all('/ipfs/bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq', (req, res) => {
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': 4
        })
        res.end(Uint8Array.from([0, 1, 2, 0]))
      })
      server.all('/ipfs/bafkqabtimvwgy3yk', async (req, res) => {
        // delay the response
        await new Promise((resolve) => setTimeout(resolve, 500))

        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': 5
        })
        // "hello"
        res.end(Uint8Array.from([104, 101, 108, 108, 111]))
      })

      await server.listen()
      const { port } = server.server.address()

      return {
        server,
        env: {
          TRUSTLESS_GATEWAY: `http://127.0.0.1:${port}`
        }
      }
    },
    async after (options, before) {
      await before.server.server.close()
    }
  }
}

export default options
