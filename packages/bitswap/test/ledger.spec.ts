import { generateKeyPair } from '@libp2p/crypto/keys'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { spy } from 'sinon'
import { stubInterface } from 'sinon-ts'
import { Ledger } from '../src/peer-want-lists/ledger.ts'
import type { Network } from '../src/network.ts'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { StubbedInstance } from 'sinon-ts'

interface LedgerComponents {
  peerId: PeerId
  blockstore: Blockstore
  network: StubbedInstance<Network>
  logger: ComponentLogger
}

describe('ledger', () => {
  let components: LedgerComponents

  beforeEach(async () => {
    components = {
      peerId: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      blockstore: new MemoryBlockstore(),
      network: stubInterface<Network>(),
      logger: defaultLogger()
    }
  })

  it('should not get blocks we do not have', async () => {
    const blockstoreGetSpy = spy(components.blockstore, 'get')
    const blockstoreHasSpy = spy(components.blockstore, 'has')

    const ledger = new Ledger(components, {

    })

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    ledger.addWants({
      entries: [{
        cid: cid.multihash.bytes,
        priority: 1
      }]
    })

    ledger.queueSendOperation()
    await ledger.sendQueue.onIdle()

    expect(blockstoreHasSpy.called).to.be.true('Did not test for block availability before getting it')
    expect(blockstoreGetSpy.called).to.be.false('Got a block from the block store when we should not have')
    expect(components.network.sendMessage.called).to.be.false('Sent a message when we should not have')
  })
})
