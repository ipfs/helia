/* eslint-disable no-console */

/**
 * Imports the module specifier passed as the first argument with a resolve
 * hook that throws if anything tries to load WebRTC (and with it the native
 * `node-datachannel` module).
 *
 * Run in a child process by `test/node.ts`, exits non-zero on failure.
 */

import { register } from 'node:module'

const FORBIDDEN = ['@libp2p/webrtc', 'node-datachannel']

const hook = `
export async function resolve (specifier, context, next) {
  if (${JSON.stringify(FORBIDDEN)}.includes(specifier)) {
    throw new Error('forbidden import of ' + specifier + ' from ' + context.parentURL)
  }

  return next(specifier, context)
}
`

register(`data:text/javascript,${encodeURIComponent(hook)}`)

const specifier = process.argv[2]

if (specifier == null) {
  throw new Error('No module specifier passed')
}

await import(specifier)

console.log(`imported ${specifier} without loading ${FORBIDDEN.join(', ')}`)
