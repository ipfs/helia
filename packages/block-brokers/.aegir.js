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
          'content-type': 'application/octet-stream'
        })
        res.end(Uint8Array.from([0, 1, 2, 0]))
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
