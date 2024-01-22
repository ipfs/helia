import getPort from 'aegir/get-port'
import { createServer } from 'ipfsd-ctl'
import * as kuboRpcClient from 'kubo-rpc-client'
import { dirname, join } from 'node:path'
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));

// create an http server that will host the fixture data files. When receiving a request for a fileName, it will return './src/fixtures/data/${fileName}'
async function createFixtureServer() {
  const port = await getPort(3333)
  const fixturesDataFolder = join(__dirname, 'src', 'fixtures', 'data')
  const server = await new Promise((resolve, _reject) => {
    const s = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Request-Method', '*');
      res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if ( req.method === 'OPTIONS' ) {
        res.writeHead(200);
        res.end();
        return;
      }
      const fileName = req.url?.split('/').pop()
      if (fileName) {
        try {
          createReadStream(join(fixturesDataFolder, fileName)).pipe(res)
          res.writeHead(200, {'Content-Type': 'application/octet-stream'})
        } catch (e) {
          console.error(e)
          res.writeHead(500, e.message)
          res.end()
        }
      } else {
        res.writeHead(404)
        res.end()
      }
    }).listen(port, () => resolve(s))
  })

  return {
    server,
    port
  }
}

/** @type {import('aegir').PartialOptions} */
export default {
  test: {
    files: './dist/src/*.spec.js',
    before: async (options) => {
      const { server: httpServer, port: httpPort } = await createFixtureServer()
      if (options.runner !== 'node') {
        const ipfsdPort = await getPort()
        const ipfsdServer = await createServer({
          host: '127.0.0.1',
          port: ipfsdPort
        }, {
          ipfsBin: (await import('kubo')).default.path(),
          kuboRpcModule: kuboRpcClient,
          ipfsOptions: {
            config: {
              Addresses: {
                Swarm: [
                  "/ip4/0.0.0.0/tcp/0",
                  "/ip4/0.0.0.0/tcp/0/ws"
                ]
              }
            }
          }
        }).start()

        return {
          env: {
            IPFSD_SERVER: `http://127.0.0.1:${ipfsdPort}`,
            FIXTURE_DATA_SERVER: `http://127.0.0.1:${httpPort}`
          },
          ipfsdServer,
          httpServer
        }
      }

      return {
        env: {
          FIXTURE_DATA_SERVER: `http://127.0.0.1:${httpPort}`
        },
        httpServer
      }
    },
    after: async (options, beforeResult) => {
      await beforeResult.httpServer.closeAllConnections()
      await beforeResult.httpServer.close()
      if (options.runner !== 'node') {
        await beforeResult.ipfsdServer.stop()
      }
    }
  }
}
