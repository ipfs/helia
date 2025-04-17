/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { raceSignal } from 'race-signal'
import Sinon from 'sinon'
import { type StubbedInstance, stubInterface } from 'sinon-ts'
import { createTrustlessGatewaySession } from '../src/trustless-gateway/session.js'
import type { TrustlessGateway } from '../src/trustless-gateway/trustless-gateway.js'
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

  it('should end session when signal is aborted', async () => {
    const cid = CID.parse('bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq')
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })

    const queryProviderStub = Sinon.stub(session, 'queryProvider')

    queryProviderStub.callsFake(async (_cid, _provider, options) => {
      return raceSignal(new Promise(resolve => {
        // never resolve
      }), options.signal)
    })

    components.routing.findProviders.returns(async function * () {
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
        ]
      }
    }())

    await expect(session.retrieve(cid, { signal: AbortSignal.timeout(50) })).to.eventually.be.rejected()
      .with.property('name', 'AbortError')
    expect(queryProviderStub.callCount).to.equal(1)
  })

  it('should not abort the session when the signal is aborted if the block is found', async () => {
    const cid = CID.parse('bafkreig7p6kzwgg4hp3n7wpnnn3kkjmpzxds5rmwhphyueilbzabvyexvq')
    const block = Uint8Array.from([0, 1, 2, 0])
    const session = createTrustlessGatewaySession(components, {
      allowInsecure: true,
      allowLocal: true
    })
    const providers = [{
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
      ]
    },
    {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
      ]
    }]

    components.routing.findProviders.returns(async function * () {
      yield providers[1]
      yield providers[0]
    }())

    const controller = new AbortController()
    const queryProviderStub = Sinon.stub(session, 'queryProvider')

    // a promise that will resolve at the exact moment we want both events to occur
    const triggerMoment = new Promise<void>(resolve => setTimeout(resolve, 50))

    queryProviderStub.withArgs(
      cid,
      Sinon.match((provider: TrustlessGateway) => provider.url.toString().includes(process.env.BAD_TRUSTLESS_GATEWAY ?? ''))
    ).callsFake(async (_cid, _provider, options) => {
      const racedPromise = triggerMoment
        .then(async () => new Promise(resolve => setTimeout(resolve, 1)))
        .then(() => { return new Uint8Array([0, 1, 2, 3]) })
      return raceSignal(racedPromise, options.signal)
    })

    queryProviderStub.withArgs(
      cid,
      Sinon.match((provider: TrustlessGateway) => provider.url.toString().includes(process.env.TRUSTLESS_GATEWAY ?? ''))
    ).callsFake(async () => {
      return triggerMoment.then(() => block)
    })

    // abort the signal
    void triggerMoment.then(async () => {
      // slight delay to ensure this resolves after the block returning provider
      await new Promise(resolve => setTimeout(resolve, 1))
      controller.abort()
    })

    await expect(session.retrieve(cid, { signal: controller.signal }))
      .to.eventually.deep.equal(block)
    expect(queryProviderStub.callCount).to.equal(2)
  })
})
