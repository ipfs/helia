import Fastify from 'fastify'

import fastifyStatic from '@fastify/static'
import * as url from 'url';
import path from 'node:path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const fastify = Fastify({
  logger: true
})

fastify.register(fastifyStatic, {
  root: path.join(__dirname, '.docs'),
  // prefix: '/', // optional: default '/'
  allowedPath: (path) => {
    process.stdout.write(`checking if path ${path} is allowed`)
    return true
  }, // optional: default undefined
})

/**
 * The goal of this script is to serve the .docs folder similar to how github pages is serving the `gh-pages` branch.
 * That means we:
 * 1. Deny access to the root of the server
 * 2. Serve the contents of the .docs folder at path /helia
 */
fastify.get('/', async (request, reply) => {
  // reply.type('application/json').code(200)
  // don't allow access to root. Same as hosted github pages
  return reply.code(403)
  // return { hello: 'world' }
})

fastify.get('/helia', async (request, reply) => {
  // serve the contents of the .docs folder
  return reply.sendFile('index.html')
})

fastify.listen({ port: 8448 }, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
  console.info(`Server is now listening on ${address}`)
})
