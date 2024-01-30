import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import { CID } from 'multiformats/cid'
import pRetry from 'p-retry'
import { stubInterface, type StubbedInstance } from 'sinon-ts'
import { DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK } from '../src/constants.js'
import { BlockPresenceType, WantType } from '../src/pb/message.js'
import { PeerWantLists } from '../src/peer-want-lists/index.js'
import ve from '../src/utils/varint-encoder.js'
import type { Network } from '../src/network.js'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'

interface PeerWantListsComponentStubs {
  peerId: PeerId
  blockstore: Blockstore
  network: StubbedInstance<Network>
  logger: ComponentLogger
}

describe('peer-want-lists', () => {
  let components: PeerWantListsComponentStubs
  let wantLists: PeerWantLists

  beforeEach(async () => {
    components = {
      peerId: await createEd25519PeerId(),
      blockstore: new MemoryBlockstore(),
      network: stubInterface<Network>(),
      logger: defaultLogger()
    }

    wantLists = new PeerWantLists(components)
  })

  it('should keep a ledger for a peer', async () => {
    const remotePeer = await createEd25519PeerId()

    expect(wantLists.ledgerForPeer(remotePeer)).to.be.undefined('should not have list initially')

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        full: true,
        entries: [{
          cid: cid.bytes,
          priority: 1
        }]
      }
    })

    const ledger = wantLists.ledgerForPeer(remotePeer)

    expect(ledger).to.have.property('peer', remotePeer)
    expect(ledger).to.have.property('value', 0)
    expect(ledger).to.have.property('sent', 0)
    expect(ledger).to.have.property('received', 0)
    expect(ledger).to.have.property('exchanged', 1)
  })

  it('should replace the wantlist for a peer when the full list is received', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid1 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const cid2 = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')

    // first wantlist
    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid1.bytes,
          priority: 1
        }]
      }
    })

    let entries = wantLists.wantListForPeer(remotePeer)

    expect(entries?.map(entry => entry.cid.toString())).to.include(cid1.toString())

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        full: true,
        entries: [{
          cid: cid2.bytes,
          priority: 1
        }]
      }
    })

    entries = wantLists.wantListForPeer(remotePeer)

    // should only have CIDs from the second message
    expect(entries?.map(entry => entry.cid.toString())).to.not.include(cid1.toString())
    expect(entries?.map(entry => entry.cid.toString())).to.include(cid2.toString())
  })

  it('should merge the wantlist for a peer when a partial list is received', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid1 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const cid2 = CID.parse('bafyreidykglsfhoixmivffc5uwhcgshx4j465xwqntbmu43nb2dzqwfvae')

    // first wantlist
    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid1.bytes,
          priority: 1
        }]
      }
    })

    let entries = wantLists.wantListForPeer(remotePeer)

    expect(entries?.map(entry => entry.cid.toString())).to.include(cid1.toString())

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid2.bytes,
          priority: 1
        }]
      }
    })

    entries = wantLists.wantListForPeer(remotePeer)

    // should have both CIDs
    expect(entries?.map(entry => entry.cid.toString())).to.include(cid1.toString())
    expect(entries?.map(entry => entry.cid.toString())).to.include(cid2.toString())
  })

  it('should record the amount of incoming data', async () => {
    const remotePeer = await createEd25519PeerId()

    await wantLists.messageReceived(remotePeer, {
      blocks: [{
        prefix: Uint8Array.from([0, 1, 2, 3, 4]),
        data: Uint8Array.from([0, 1, 2, 3, 4])
      }, {
        prefix: Uint8Array.from([0, 1, 2]),
        data: Uint8Array.from([0, 1, 2])
      }],
      blockPresences: [],
      pendingBytes: 0
    })

    const ledger = wantLists.ledgerForPeer(remotePeer)

    expect(ledger).to.have.property('received', 8)
  })

  it('should send requested blocks to peer', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3, 4])

    // we have block
    await components.blockstore.put(cid, block)

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1
        }]
      }
    })

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blocks).to.have.lengthOf(1)
    expect(message.blocks?.[0].data).to.equalBytes(block)
    expect(message.blocks?.[0].prefix).to.equalBytes(ve([
      cid.version, cid.code, cid.multihash.code, cid.multihash.digest.byteLength
    ]))

    // have to wait for network send
    await delay(1)

    expect(wantLists.wantListForPeer(remotePeer)?.map(entry => entry.cid.toString())).to.not.include(cid.toString())
  })

  it('should send requested block presences to peer', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from(new Array(DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK + 1))

    // we have block
    await components.blockstore.put(cid, block)

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1,
          wantType: WantType.WantHave
        }]
      }
    })

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blocks).to.be.empty('should not have sent blocks')
    expect(message.blockPresences).to.have.lengthOf(1)
    expect(message.blockPresences?.[0].cid).to.equalBytes(cid.bytes)
    expect(message.blockPresences?.[0].type).to.equal(BlockPresenceType.HaveBlock, 'should have sent HaveBlock presence')
  })

  it('should send requested lack of block presences to peer', async () => {
    const remotePeer = await createEd25519PeerId()

    // CID for a block we don't have
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1,
          wantType: WantType.WantBlock,
          sendDontHave: true
        }]
      }
    })

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blocks).to.be.empty('should not have sent blocks')
    expect(message.blockPresences).to.have.lengthOf(1)
    expect(message.blockPresences?.[0].cid).to.equalBytes(cid.bytes)
    expect(message.blockPresences?.[0].type).to.equal(BlockPresenceType.DontHaveBlock, 'should have sent DontHaveBlock presence')
  })

  it('should send requested blocks to peer when presence was requested but block size is less than maxSizeReplaceHasWithBlock', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3, 4])

    // we have block
    await components.blockstore.put(cid, block)

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1,
          wantType: WantType.WantHave
        }]
      }
    })

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blockPresences).to.be.empty()
    expect(message.blocks).to.have.lengthOf(1)
    expect(message.blocks?.[0].data).to.equalBytes(block)
    expect(message.blocks?.[0].prefix).to.equalBytes(ve([
      cid.version, cid.code, cid.multihash.code, cid.multihash.digest.byteLength
    ]))

    // have to wait for network send
    await delay(1)

    expect(wantLists.wantListForPeer(remotePeer)?.map(entry => entry.cid.toString())).to.not.include(cid.toString())
  })

  it('should send requested block presences to peer for blocks we don\'t have', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1,
          wantType: WantType.WantHave,
          sendDontHave: true
        }]
      }
    })

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blocks).to.be.empty('should not have sent blocks')
    expect(message.blockPresences).to.have.lengthOf(1)
    expect(message.blockPresences?.[0].cid).to.equalBytes(cid.bytes)
    expect(message.blockPresences?.[0].type).to.equal(BlockPresenceType.DontHaveBlock, 'should have sent DontHaveBlock presence')
  })

  it('should remove wants when peer cancels', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1
        }]
      }
    })

    expect(wantLists.wantListForPeer(remotePeer)?.map(entry => entry.cid.toString())).to.include(cid.toString())

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1,
          cancel: true
        }]
      }
    })

    expect(wantLists.wantListForPeer(remotePeer)?.map(entry => entry.cid.toString())).to.not.include(cid.toString())
  })

  it('should remove wantlist and ledger when peer disconnects', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3, 4])

    // we have block
    await components.blockstore.put(cid, block)

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1
        }]
      }
    })

    expect(wantLists.ledgerForPeer(remotePeer)).to.be.ok()
    expect(wantLists.wantListForPeer(remotePeer)).to.be.ok()

    wantLists.peerDisconnected(remotePeer)

    expect(wantLists.ledgerForPeer(remotePeer)).to.be.undefined()
    expect(wantLists.wantListForPeer(remotePeer)).to.be.undefined()
  })

  it('should return peers with want lists', async () => {
    const remotePeer = await createEd25519PeerId()

    expect(wantLists.peers()).to.be.empty()

    await wantLists.messageReceived(remotePeer, {
      blocks: [{
        prefix: Uint8Array.from([0, 1, 2, 3, 4]),
        data: Uint8Array.from([0, 1, 2, 3, 4])
      }, {
        prefix: Uint8Array.from([0, 1, 2]),
        data: Uint8Array.from([0, 1, 2])
      }],
      blockPresences: [],
      pendingBytes: 0
    })

    expect(wantLists.peers().map(p => p.toString())).to.include(remotePeer.toString())
  })

  it('should send requested blocks to peer when they are received', async () => {
    const remotePeer = await createEd25519PeerId()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const block = Uint8Array.from([0, 1, 2, 3, 4])

    await wantLists.messageReceived(remotePeer, {
      blocks: [],
      blockPresences: [],
      pendingBytes: 0,
      wantlist: {
        entries: [{
          cid: cid.bytes,
          priority: 1
        }]
      }
    })

    expect(wantLists.wantListForPeer(remotePeer)?.map(e => e.cid.toString())).to.include(cid.toString())

    // now we have block
    await components.blockstore.put(cid, block)

    // we received it
    await wantLists.receivedBlock(cid, {})

    // wait for network send
    await pRetry(() => {
      if (!components.network.sendMessage.called) {
        throw new Error('Network message not sent')
      }
    })

    const message = components.network.sendMessage.getCall(0).args[1]

    expect(message.blocks).to.have.lengthOf(1)
    expect(message.blocks?.[0].data).to.equalBytes(block)
    expect(message.blocks?.[0].prefix).to.equalBytes(ve([
      cid.version, cid.code, cid.multihash.code, cid.multihash.digest.byteLength
    ]))

    // have to wait for network send
    await delay(1)

    expect(wantLists.wantListForPeer(remotePeer)?.map(entry => entry.cid.toString()))
      .to.not.include(cid.toString())

    // should only have sent one message
    await delay(100)
    expect(components.network.sendMessage.callCount).to.equal(1)
  })
})
