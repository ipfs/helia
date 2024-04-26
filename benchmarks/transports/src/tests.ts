import type { Multiaddr } from '@multiformats/multiaddr'

export interface Test {
  name: string
  senderExec?: string
  senderArgs?: string[]
  senderListen: string
  senderTransports: string
  senderBlockstore: string
  senderDatastore: string
  recipientExec?: string
  recipientArgs?: string[]
  recipientTransports: string
  recipientBlockstore: string
  recipientDatastore: string
}

const PLAYWRIGHT = 'playwright-test'

interface Impl {
  exec?: string
  args?: string[]
  transports: string
  listen?: (relay: Multiaddr) => string
  blockstore: string
  datastore: string
}

const webRTCimpls: Record<string, Impl> = {
  'node.js': {
    transports: 'webRTC,circuitRelay,ws',
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`,
    blockstore: 'fs',
    datastore: 'level'
  },
  'chromium': {
    exec: PLAYWRIGHT,
    transports: 'webRTC,circuitRelay,ws',
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`,
    blockstore: 'idb',
    datastore: 'idb'
  },
  'firefox': {
    exec: PLAYWRIGHT,
    args: ['--browser', 'firefox'],
    transports: 'webRTC,circuitRelay,ws',
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`,
    blockstore: 'idb',
    datastore: 'idb'
  }
}

const webSocketimpls: Record<string, Impl> = {
  'node.js': {
    transports: 'ws',
    listen: () => `/ip4/127.0.0.1/tcp/0/ws`,
    blockstore: 'fs',
    datastore: 'level'
  },
  'chromium': {
    exec: PLAYWRIGHT,
    transports: 'ws',
    blockstore: 'idb',
    datastore: 'idb'
  },
  'firefox': {
    exec: PLAYWRIGHT,
    args: ['--browser', 'firefox'],
    transports: 'ws',
    blockstore: 'idb',
    datastore: 'idb'
  }
}

const tcpImpls: Record<string, Impl> = {
  'node.js': {
    transports: 'tcp',
    listen: () => `/ip4/127.0.0.1/tcp/0`,
    blockstore: 'fs',
    datastore: 'level'
  }
}

function addTests (name: string, impls: Record<string, Impl>, tests: Test[], relay: Multiaddr) {
  for (const [implAName, implA] of Object.entries(impls)) {
    for (const [implBName, implB] of Object.entries(impls)) {
      if (implA.listen == null) {
        continue
      }

      tests.push({
        name: `${name} (${implAName} -> ${implBName})`,

        senderExec: implA.exec,
        senderArgs: implA.args,
        senderListen: implA.listen(relay),
        senderTransports: implA.transports,
        senderBlockstore: implA.blockstore,
        senderDatastore: implA.datastore,

        recipientExec: implB.exec,
        recipientArgs: implB.args,
        recipientTransports: implB.transports,
        recipientBlockstore: implB.blockstore,
        recipientDatastore: implB.datastore
      })
    }
  }
}

export function createTests (relay: Multiaddr): Test[] {
  const output: Test[] = []

  addTests('TCP', tcpImpls, output, relay)
  addTests('WebSockets', webSocketimpls, output, relay)
  addTests('WebRTC', webRTCimpls, output, relay)

  return output
}
