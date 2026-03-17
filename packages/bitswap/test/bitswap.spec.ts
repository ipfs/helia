import { generateKeyPair } from '@libp2p/crypto/keys'
import { start, stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import { base64 } from 'multiformats/bases/base64'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { Bitswap } from '../src/bitswap.ts'
import { DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK } from '../src/constants.ts'
import { WantType } from '../src/pb/message.ts'
import { cidToPrefix } from '../src/utils/cid-prefix.ts'
import type { MultihashHasherLoader } from '../src/index.ts'
import type { BitswapMessageEventDetail } from '../src/network.ts'
import type { Routing } from '@helia/interface/routing'
import type { Libp2p, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { StubbedInstance } from 'sinon-ts'

interface StubbedBitswapComponents {
  peerId: PeerId
  routing: StubbedInstance<Routing>
  blockstore: Blockstore
  libp2p: StubbedInstance<Libp2p>
}

describe('bitswap', () => {
  let components: StubbedBitswapComponents
  let bitswap: Bitswap
  let cids: CID[]
  let blocks: Uint8Array[]
  let hashLoader: StubbedInstance<MultihashHasherLoader>
  let remotePeer: PeerId

  beforeEach(async () => {
    blocks = []
    cids = []

    for (let i = 0; i < 5; i++) {
      const block = new Uint8Array(DEFAULT_MAX_SIZE_REPLACE_HAS_WITH_BLOCK + 1).fill(i)
      const cid = CID.createV0(await sha256.digest(block)).toV1()

      blocks.push(block)
      cids.push(cid)
    }

    hashLoader = stubInterface<MultihashHasherLoader>()
    remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    components = {
      peerId: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      routing: stubInterface<Routing>(),
      blockstore: new MemoryBlockstore(),
      libp2p: stubInterface<Libp2p>({
        metrics: undefined
      })
    }

    bitswap = new Bitswap({
      ...components,
      logger: defaultLogger()
    }, {
      hashLoader,
      doNotResendBlockWindow: 1_500
    })

    components.libp2p.getConnections.returns([])

    await start(bitswap)
  })

  afterEach(async () => {
    if (bitswap != null) {
      await stop(bitswap)
    }
  })

  describe('want', () => {
    it('should want a block that is available on the network', async () => {
      const findProvsSpy = bitswap.network.findAndConnect = Sinon.stub()
      findProvsSpy.resolves()

      // add peer
      bitswap.wantList.peers.set(remotePeer, new Set())

      // wait for message send to peer
      const sentMessages = pDefer()

      bitswap.network.sendMessage = async (peerId) => {
        if (remotePeer.equals(peerId)) {
          sentMessages.resolve()
        }
      }

      const p = bitswap.want(cids[0])

      // wait for message send to peer
      await sentMessages.promise

      // provider sends message
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            blocks: [{
              prefix: cidToPrefix(cids[0]),
              data: blocks[0]
            }],
            blockPresences: [],
            pendingBytes: 0
          }
        }
      })

      const b = await p

      // should have added cid to wantlist and searched for providers
      expect(findProvsSpy.called).to.be.true()

      // should have cancelled the notification request
      expect(b).to.equalBytes(blocks[0])
    })

    it('should want a block with a truncated hash', async () => {
      hashLoader.getHasher.withArgs(sha512.code).resolves(sha512)

      const mh = await sha512.digest(blocks[0], {
        truncate: 32
      })
      const cid = CID.createV1(raw.code, mh)

      const findProvsSpy = bitswap.network.findAndConnect = Sinon.stub()
      findProvsSpy.resolves()

      // add peer
      bitswap.wantList.peers.set(remotePeer, new Set())

      // wait for message send to peer
      const sentMessages = pDefer()

      bitswap.network.sendMessage = async (peerId) => {
        if (remotePeer.equals(peerId)) {
          sentMessages.resolve()
        }
      }

      const p = bitswap.want(cid)

      // wait for message send to peer
      await sentMessages.promise

      // provider sends message
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            blocks: [{
              prefix: cidToPrefix(cid),
              data: blocks[0]
            }],
            blockPresences: [],
            pendingBytes: 0
          }
        }
      })

      const b = await p

      // should have added cid to wantlist and searched for providers
      expect(findProvsSpy.called).to.be.true()

      // should have cancelled the notification request
      expect(b).to.equalBytes(blocks[0])
    })

    it('should abort wanting a block that is not available on the network', async () => {
      const p = bitswap.want(cids[0], {
        signal: AbortSignal.timeout(100)
      })

      await expect(p).to.eventually.be.rejected
        .with.property('name', 'AbortError')
    })

    it('should notify peers we have a block', async () => {
      const receivedBlockSpy = Sinon.spy(bitswap.peerWantLists, 'receivedBlock')

      await bitswap.notify(cids[0])

      expect(receivedBlockSpy.called).to.be.true()
    })
  })

  describe('wantlist', () => {
    it('should remove CIDs from the wantlist when the block arrives', async () => {
      expect(bitswap.getWantlist()).to.be.empty()

      const findProvsSpy = bitswap.network.findAndConnect = Sinon.stub()
      findProvsSpy.resolves()

      // add peer
      bitswap.wantList.peers.set(remotePeer, new Set())

      // wait for message send to peer
      const sentMessages = pDefer()

      bitswap.network.sendMessage = async (peerId) => {
        if (remotePeer.equals(peerId)) {
          sentMessages.resolve()
        }
      }

      const p = bitswap.want(cids[0])

      // wait for message send to peer
      await sentMessages.promise

      expect(bitswap.getWantlist().map(w => w.cid)).to.include(cids[0])

      // provider sends message
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            blocks: [{
              prefix: cidToPrefix(cids[0]),
              data: blocks[0]
            }],
            blockPresences: [],
            pendingBytes: 0
          }
        }
      })

      const b = await p

      expect(bitswap.getWantlist()).to.be.empty()
      expect(b).to.equalBytes(blocks[0])
    })

    it('should remove CIDs from the wantlist when the want is aborted', async () => {
      expect(bitswap.getWantlist()).to.be.empty()

      const p = bitswap.want(cids[0], {
        signal: AbortSignal.timeout(100)
      })

      expect(bitswap.getWantlist().map(w => w.cid)).to.include(cids[0])

      await expect(p).to.eventually.be.rejected
        .with.property('name', 'AbortError')

      expect(bitswap.getWantlist()).to.be.empty()
    })
  })

  describe('peer wantlist', () => {
    it('should return a peer wantlist', async () => {
      // don't have this peer yet
      expect(bitswap.getPeerWantlist(remotePeer)).to.be.undefined()

      // peers sends message with wantlist
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(bitswap.getPeerWantlist(remotePeer)?.map(entry => entry.cid)).to.deep.equal([cids[0]])
    })

    it('should only send a block once', async () => {
      // we have the block
      await components.blockstore.put(cids[0], blocks[0])

      const sendMessageStub = bitswap.network.sendMessage = Sinon.stub()

      // peers sends multiple messages with repeated wants for the same cid
      for (let i = 0; i < 5; i++) {
        bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
          detail: {
            peer: remotePeer,
            message: {
              wantlist: {
                full: false,
                entries: [{
                  cid: cids[0].bytes,
                  priority: 100
                }]
              },
              blockPresences: [],
              blocks: [],
              pendingBytes: 0
            }
          }
        })
      }

      expect(sendMessageStub.getCalls()).to.have.property('length', 0)

      await delay(1_000)

      expect(sendMessageStub.getCalls()).to.have.property('length', 1)
      expect(sendMessageStub.getCall(0).args[0].equals(remotePeer)).to.be.true()
      expect(sendMessageStub.getCall(0).args[1].blocks.has(base64.encode(cids[0].multihash.bytes))).to.be.true()
    })

    it('should retain want during do-not-resend window with "sent" status', async () => {
      // we have the block
      await components.blockstore.put(cids[0], blocks[0])

      bitswap.network.sendMessage = Sinon.stub()

      // peer sends a WantHave for the first block
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(bitswap.getPeerWantlist(remotePeer)?.map(entry => ({
        cid: entry.cid,
        status: entry.status
      }))).to.deep.equal([{
        cid: cids[0],
        status: 'sending'
      }])

      await delay(1_000)

      // want should still be present during do-not-resend window
      expect(bitswap.getPeerWantlist(remotePeer)?.map(entry => ({
        cid: entry.cid,
        status: entry.status
      }))).to.deep.equal([{
        cid: cids[0],
        status: 'sent'
      }])

      await delay(1_000)

      // should have removed want after do-not-resend window
      expect(bitswap.getPeerWantlist(remotePeer)).to.be.empty()
    })

    it('should upgrade a WantHave to a WantBlock while the send is in progress', async () => {
      // we have the block
      await components.blockstore.put(cids[0], blocks[0])

      const sendMessageStub = bitswap.network.sendMessage = Sinon.stub()

      // peer sends a WantHave
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantHave
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(sendMessageStub.getCalls()).to.have.property('length', 0)

      // peer sends a WantBlock before WantHave is resolved
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantBlock
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      await delay(1_000)

      expect(sendMessageStub.getCalls()).to.have.property('length', 1)
      expect(sendMessageStub.getCall(0).args[0].equals(remotePeer)).to.be.true()
      expect(sendMessageStub.getCall(0).args[1].blocks.has(base64.encode(cids[0].multihash.bytes))).to.be.true()
    })

    it('should upgrade a WantHave to a WantBlock if the message is still being sent when the upgrade arrives', async () => {
      // we have the blocks
      await components.blockstore.put(cids[0], blocks[0])
      await components.blockstore.put(cids[1], blocks[1])

      const sendMessageStub = bitswap.network.sendMessage = Sinon.stub()

      // peer sends a WantHave for the first block
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantHave
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(sendMessageStub.getCalls()).to.have.property('length', 0)

      // peer sends a WantBlock for the second block and upgrades the WantHave
      // to a WantBlock for the first
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantBlock
              }, {
                cid: cids[1].bytes,
                priority: 100,
                wantType: WantType.WantBlock
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      await delay(1_000)

      expect(sendMessageStub.getCalls()).to.have.property('length', 2)

      // the WantHave for cid1 was converted to a WantBlock while it was being
      // sent
      expect(sendMessageStub.getCall(0).args[1].blocks.has(base64.encode(cids[0].multihash.bytes))).to.be.true()

      // the WantHave for cid2 is honoured as part of the second message
      expect(sendMessageStub.getCall(1).args[1].blocks.has(base64.encode(cids[1].multihash.bytes))).to.be.true()

      // the block for cid1 was not sent again as it was sent in the first
      // message
      expect(sendMessageStub.getCall(1).args[1].blocks.has(base64.encode(cids[0].multihash.bytes))).to.be.false()
    })

    it('should send a WantBlock after a WantHave', async () => {
      // we have the block
      await components.blockstore.put(cids[0], blocks[0])
      await components.blockstore.put(cids[1], blocks[1])
      await components.blockstore.put(cids[2], blocks[2])

      const sendMessageStub = bitswap.network.sendMessage = Sinon.stub()

      // peer sends a WantHaves for the first blocks
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantHave
              }, {
                cid: cids[1].bytes,
                priority: 100,
                wantType: WantType.WantHave
              }, {
                cid: cids[2].bytes,
                priority: 100,
                wantType: WantType.WantHave
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(sendMessageStub.getCalls()).to.have.property('length', 0)

      // peer sends a WantBlock for the second block and upgrades the WantHave
      // to a WantBlock for the first
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            wantlist: {
              full: false,
              entries: [{
                cid: cids[0].bytes,
                priority: 100,
                wantType: WantType.WantBlock
              }, {
                cid: cids[2].bytes,
                priority: 100,
                wantType: WantType.WantBlock
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      await delay(1_000)

      expect(sendMessageStub.getCalls()).to.have.property('length', 2)

      // the second message has fewer blocks so is processed faster and sent
      // before the first
      expect(sendMessageStub.getCall(0).args[1].blocks.has(base64.encode(cids[2].multihash.bytes))).to.be.true()

      expect(sendMessageStub.getCall(1).args[1].blocks.has(base64.encode(cids[0].multihash.bytes))).to.be.true()
      expect(sendMessageStub.getCall(1).args[1].blockPresences.has(base64.encode(cids[1].multihash.bytes))).to.be.true()
    })
  })
})
