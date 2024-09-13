import type { Multiaddr } from '@multiformats/multiaddr'

export interface Test {
  name: string

  senderImplementation: string
  senderExec?: string
  senderArgs?: string[]
  senderListen: string

  recipientImplementation: string
  recipientExec?: string
  recipientArgs?: string[]
}

const PLAYWRIGHT = 'playwright-test'

interface Impl {
  type: 'helia' | 'kubo'
  exec?: string
  args?: string[]
  listen?(relay: Multiaddr): string
}

const webRTCimpls: Record<string, Impl> = {
  chromium: {
    type: 'helia',
    exec: PLAYWRIGHT,
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`
  },
  firefox: {
    type: 'helia',
    exec: PLAYWRIGHT,
    args: ['--browser', 'firefox'],
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`
  },
  webkit: {
    type: 'helia',
    exec: PLAYWRIGHT,
    args: ['--browser', 'webkit'],
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`
  },
  'node.js': {
    type: 'helia',
    listen: (relay) => `${relay}/p2p-circuit,/webrtc`
  }
}

const webSocketimpls: Record<string, Impl> = {
  'node.js': {
    type: 'helia',
    listen: () => '/ip4/127.0.0.1/tcp/0/ws'
  },
  chromium: {
    type: 'helia',
    exec: PLAYWRIGHT
  },
  firefox: {
    type: 'helia',
    exec: PLAYWRIGHT,
    args: ['--browser', 'firefox']
  },
  kubo: {
    type: 'kubo',
    listen: () => '/ip4/127.0.0.1/tcp/0/ws'
  }
}

const webTransportImpls: Record<string, Impl> = {
  chromium: {
    type: 'helia',
    exec: PLAYWRIGHT
  },
  firefox: {
    type: 'helia',
    exec: PLAYWRIGHT,
    args: ['--browser', 'firefox']
  },
  kubo: {
    type: 'kubo',
    listen: () => '/ip4/127.0.0.1/udp/0/quic-v1/webtransport'
  }
}

const tcpImpls: Record<string, Impl> = {
  'node.js': {
    type: 'helia',
    listen: () => '/ip4/127.0.0.1/tcp/0'
  },
  kubo: {
    type: 'kubo',
    listen: () => '/ip4/127.0.0.1/tcp/0'
  }
}

function addTests (name: string, impls: Record<string, Impl>, tests: Test[], relay: Multiaddr): void {
  for (const [implAName, implA] of Object.entries(impls)) {
    for (const [implBName, implB] of Object.entries(impls)) {
      if (implA.listen == null) {
        continue
      }

      tests.push({
        name: `${name} (${implAName} -> ${implBName})`,

        senderImplementation: implA.type,
        senderExec: implA.exec,
        senderArgs: implA.args,
        senderListen: implA.listen(relay),

        recipientImplementation: implB.type,
        recipientExec: implB.exec,
        recipientArgs: implB.args
      })
    }
  }
}

export function createTests (relay: Multiaddr): Test[] {
  const output: Test[] = []

  addTests('WebRTC', webRTCimpls, output, relay)
  addTests('WebTransport', webTransportImpls, output, relay)
  addTests('WebSockets', webSocketimpls, output, relay)
  addTests('TCP', tcpImpls, output, relay)

  return output
}
