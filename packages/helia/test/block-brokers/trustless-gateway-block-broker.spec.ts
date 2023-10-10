/* eslint-env mocha */
import { expect } from 'aegir/chai'
import * as raw from 'multiformats/codecs/raw'
import { type StubbedInstance, stubConstructor } from 'sinon-ts'
import { TrustlessGatewayBlockBroker } from '../../src/block-brokers/index.js'
import { TrustlessGateway } from '../../src/block-brokers/trustless-gateway-block-broker.js'
import { createBlock } from '../fixtures/create-block.js'
import type { CID } from 'multiformats/cid'

describe('trustless-gateway-block-broker', () => {
  let blocks: Array<{ cid: CID, block: Uint8Array }>
  let gatewayBlockBroker: TrustlessGatewayBlockBroker
  let gateways: Array<StubbedInstance<TrustlessGateway>>
  // let gateways: Array<TrustedGateway>

  beforeEach(async () => {
    blocks = []

    for (let i = 0; i < 10; i++) {
      blocks.push(await createBlock(raw.code, Uint8Array.from([0, 1, 2, i])))
    }

    gateways = [
      stubConstructor(TrustlessGateway, 'http://localhost:8080'),
      stubConstructor(TrustlessGateway, 'http://localhost:8081'),
      stubConstructor(TrustlessGateway, 'http://localhost:8082'),
      stubConstructor(TrustlessGateway, 'http://localhost:8083')
    ]
    gatewayBlockBroker = new TrustlessGatewayBlockBroker(gateways)
  })

  it('tries all gateways before failing', async () => {
    // stub all gateway responses to fail
    for (const gateway of gateways) {
      gateway.getRawBlock.rejects(new Error('failed'))
    }
    try {
      await gatewayBlockBroker.retrieve(blocks[0].cid)
      throw new Error('should have failed')
    } catch (err: unknown) {
      expect(err).to.exist()
    }
    for (const gateway of gateways) {
      expect(gateway.getRawBlock.calledWith(blocks[0].cid)).to.be.true()
    }
  })

  it('prioritizes gateways based on reliability', async () => {
    // stub all gateway responses to fail
    for (const gateway of gateways) {
      gateway.getRawBlock.rejects(new Error('failed'))
    }
    // try to get a block
    try {
      await gatewayBlockBroker.retrieve(blocks[0].cid)
      throw new Error('should have failed')
    } catch (err: unknown) {
      expect(err).to.exist()
    }

    for (const gateway of gateways) {
      expect(gateway.getRawBlock.calledWith(blocks[0].cid)).to.be.true()
    }
    // stub the first gateway to succeed
    gateways[0].getRawBlock.resolves(blocks[1].block)
    // try to get a block and ensure the first gateway was called
    await gatewayBlockBroker.retrieve(blocks[1].cid)
    expect(gateways[0].getRawBlock.calledWith(blocks[1].cid)).to.be.true()
    expect(gateways[1].getRawBlock.calledWith(blocks[1].cid)).to.be.false()
    expect(gateways[2].getRawBlock.calledWith(blocks[1].cid)).to.be.false()
    expect(gateways[3].getRawBlock.calledWith(blocks[1].cid)).to.be.false()
  })
})
