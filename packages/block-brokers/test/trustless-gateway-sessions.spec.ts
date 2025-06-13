/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { createTrustlessGatewaySession } from '../src/trustless-gateway/session.js'
import type { Routing } from '@helia/interface'
import type { ComponentLogger } from '@libp2p/interface'
import type { StubbedInstance } from 'sinon-ts'

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

  it('should end session when signal is aborted', async () => {
    const cid = CID.parse('bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq')
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })

    const queryProviderSpy = Sinon.spy(session, 'queryProvider')

    components.routing.findProviders.returns(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
        ]
      }
    }())

    await expect(session.retrieve(cid, { signal: AbortSignal.timeout(500) })).to.eventually.be.rejected()
      .with.property('name', 'AbortError')
    expect(queryProviderSpy.callCount).to.equal(1)
  })

  it('should not abort the session when the signal is aborted if the block is found', async () => {
    const cid = CID.parse('bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq')
    const block = Uint8Array.from([0, 1, 2, 0])
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true,
      transformRequestInit: (requestInit) => {
        requestInit.headers = {
          // The difference here on my machine is 25ms.. if the difference between finding the block and the signal being aborted is less than 22ms, then the test will fail.
          delay: '478'
        }
        return requestInit
      }
    })

    const queryProviderSpy = Sinon.spy(session, 'queryProvider')

    components.routing.findProviders.returns(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
        ]
      }
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
        ]
      }
    }())

    await expect(session.retrieve(cid, { signal: AbortSignal.timeout(500) })).to.eventually.deep.equal(block)
    expect(queryProviderSpy.callCount).to.equal(2)
  })
})
