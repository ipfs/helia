/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { createTrustlessGatewaySession } from '../src/trustless-gateway/session.js'
import type { Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'

interface StubbedTrustlessGatewaySessionComponents {
  logger: ComponentLogger
  routing: StubbedInstance<Routing>
}

describe('trustless-gateway sessions', () => {
  let components: StubbedTrustlessGatewaySessionComponents

  beforeEach(async () => {
    components = {
      logger: defaultLogger(),
      routing: stubInterface<Routing>()
    }
  })

  it('should find and query provider', async () => {
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })

    const cid = CID.parse('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    const block = Uint8Array.from([0, 1, 2, 0])

    components.routing.findProviders.returns(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
        ]
      }
    }())

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
  })

  it('should ignore non-http providers', async () => {
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })

    const cid = CID.parse('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    const block = Uint8Array.from([0, 1, 2, 0])

    components.routing.findProviders.returns(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          multiaddr('/ip4/127.0.0.1/tcp/1234')
        ]
      }
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          multiaddr('/ip4/127.0.0.1/udp/1234/quic-v1')
        ]
      }
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
        ]
      }
    }())

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
  })

  it('should ignore duplicate providers', async () => {
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })

    const cid = CID.parse('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    const block = Uint8Array.from([0, 1, 2, 0])

    const queryProviderSpy = Sinon.spy(session, 'queryProvider')

    const prov = {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
      ]
    }

    components.routing.findProviders.returns(async function * () {
      yield prov
      yield prov
      yield prov
    }())

    await expect(session.retrieve(cid)).to.eventually.deep.equal(block)
    expect(queryProviderSpy.callCount).to.equal(1)
  })
})
