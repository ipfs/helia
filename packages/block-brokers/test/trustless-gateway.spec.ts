/* eslint-env mocha */

import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { expect } from 'aegir/chai'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { stubInterface } from 'sinon-ts'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { TrustlessGatewayBlockBroker } from '../src/trustless-gateway/broker.js'
import { TrustlessGateway } from '../src/trustless-gateway/trustless-gateway.js'
import type { Provider, Routing } from '@helia/interface'
import type { StubbedInstance } from 'sinon-ts'

describe('trustless-gateway-block-broker', () => {
  let gatewayBlockBroker: TrustlessGatewayBlockBroker
  let routing: StubbedInstance<Required<Routing>>
  let badGatewayPeer: Provider
  let goodGatewayPeer: Provider
  let cid: CID
  let expectedBlock: Uint8Array

  beforeEach(async () => {
    // see .aegir.js - bad gateway returns block that fails validation
    cid = CID.parse('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    expectedBlock = Uint8Array.from([0, 1, 2, 0])

    routing = stubInterface()

    badGatewayPeer = {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
      ],
      routing: 'test-routing'
    }
    goodGatewayPeer = {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
      ],
      routing: 'test-routing'
    }

    gatewayBlockBroker = new TrustlessGatewayBlockBroker({
      routing,
      logger: defaultLogger()
    }, {
      allowInsecure: true,
      allowLocal: true
    })
  })

  it('tries all gateways before failing', async () => {
    routing.findProviders.callsFake(async function * () {
      yield badGatewayPeer
      yield badGatewayPeer
    })

    // see .aegir.js - bad gateway returns 500
    const cid = CID.parse('bafkreihrn5vx6hgqqltsfbhyr4fqlfu47icddprfubkqrztm6yft5iwpmm')

    await expect(gatewayBlockBroker.retrieve?.(cid))
      .to.eventually.be.rejected()
      .with.property('errors')
      .with.lengthOf(2)
  })

  it('tries other gateways if it receives invalid blocks', async () => {
    routing.findProviders.callsFake(async function * () {
      yield badGatewayPeer
      yield goodGatewayPeer
    })

    const block = await gatewayBlockBroker.retrieve?.(cid, {
      validateFn: async (block) => {
        const hash = await sha256.digest(block)

        if (!uint8ArrayEquals(hash.digest, cid.multihash.digest)) {
          throw new Error('Bad hash')
        }
      }
    })

    expect(block).to.equalBytes(expectedBlock)
  })

  it('does not call other gateways if the first gateway returns a valid block', async () => {
    routing.findProviders.callsFake(async function * () {
      yield goodGatewayPeer
      yield badGatewayPeer
    })

    const cid = CID.parse('bafkreiefnkxuhnq3536qo2i2w3tazvifek4mbbzb6zlq3ouhprjce5c3aq')
    const expectedBlock = Uint8Array.from([0, 1, 2, 0])

    const block = await gatewayBlockBroker.retrieve?.(cid, {
      validateFn: async (block) => {
        const hash = await sha256.digest(block)

        if (!uint8ArrayEquals(hash.digest, cid.multihash.digest)) {
          throw new Error('Bad hash')
        }
      }
    })

    expect(block).to.equalBytes(expectedBlock)
  })

  it('creates a session', async () => {
    routing.findProviders.returns(async function * () {
      // non-http provider
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          multiaddr('/ip4/132.32.25.6/tcp/1234')
        ],
        routing: 'test-routing'
      }
      // expired peer info
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [],
        routing: 'test-routing'
      }
      // http gateway
      yield {
        id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
        multiaddrs: [
          uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
        ],
        routing: 'test-routing'
      }
    }())

    const sessionBlockstore = gatewayBlockBroker.createSession?.({
      minProviders: 1,
      allowInsecure: true,
      allowLocal: true
    })

    expect(sessionBlockstore).to.be.ok()

    await expect(sessionBlockstore?.retrieve?.(cid)).to.eventually.deep.equal(expectedBlock)
  })

  it('does not trigger new network requests if the same cid request is in-flight', async function () {
    // from .aegir.js polka server
    const cid = CID.parse('bafkqabtimvwgy3yk')
    if (process.env.TRUSTLESS_GATEWAY == null) {
      return this.skip()
    }
    const trustlessGateway = new TrustlessGateway(process.env.TRUSTLESS_GATEWAY, { logger: defaultLogger() })

    // Call getRawBlock multiple times with the same CID
    const promises = Array.from({ length: 10 }, async () => trustlessGateway.getRawBlock(cid))

    // Wait for both promises to resolve
    const [block1, ...blocks] = await Promise.all(promises)

    // Assert that all calls to getRawBlock returned the same block
    for (const block of blocks) {
      expect(block).to.deep.equal(block1)
    }

    expect(trustlessGateway.getStats()).to.deep.equal({
      // attempt is only incremented when a new request is made
      attempts: 1,
      errors: 0,
      invalidBlocks: 0,
      successes: 1,
      pendingResponses: 0 // the queue is empty
    })
  })

  it('can pass custom headers to the gateway', async function () {
    if (process.env.TRUSTLESS_GATEWAY == null) {
      return this.skip()
    }
    const cid = CID.parse('bafybeic3q4y65yxu3yckr76q63bcvanhklwf6cwxuacnrot6v3gykrgsvq')

    const trustlessGateway = new TrustlessGateway(process.env.TRUSTLESS_GATEWAY, {
      logger: defaultLogger(),
      transformRequestInit: (requestInit) => {
        requestInit.headers = {
          ...requestInit.headers,
          'X-My-Header': 'my-value'
        }

        return requestInit
      }
    })

    await fetch(`${process.env.TRUSTLESS_GATEWAY}/logs/enable`)
    await trustlessGateway.getRawBlock(cid)
    await fetch(`${process.env.TRUSTLESS_GATEWAY}/logs/disable`)

    const reqLogs = await fetch(`${process.env.TRUSTLESS_GATEWAY}/logs`)
    const logs = await reqLogs.json()
    await fetch(`${process.env.TRUSTLESS_GATEWAY}/logs/clear`)

    // assert that fetch was called with the custom header
    expect(logs).to.have.lengthOf(1)
    expect(logs[0].headers['x-my-header']).to.equal('my-value')
  })
})
