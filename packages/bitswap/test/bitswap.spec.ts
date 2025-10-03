import { generateKeyPair } from '@libp2p/crypto/keys'
import { start, stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { Bitswap } from '../src/bitswap.js'
import { cidToPrefix } from '../src/utils/cid-prefix.js'
import type { BitswapMessageEventDetail } from '../src/network.js'
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
  let cid: CID
  let block: Uint8Array

  beforeEach(async () => {
    block = Uint8Array.from([0, 1, 2, 3, 4])
    const mh = await sha256.digest(block)
    cid = CID.createV0(mh).toV1()

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
      const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
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
              data: block
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
      expect(b).to.equalBytes(block)
    })

    it('should abort wanting a block that is not available on the network', async () => {
      const p = bitswap.want(cid, {
        signal: AbortSignal.timeout(100)
      })

      await expect(p).to.eventually.be.rejected
        .with.property('name', 'AbortError')
    })

    it('should notify peers we have a block', async () => {
      const receivedBlockSpy = Sinon.spy(bitswap.peerWantLists, 'receivedBlock')

      await bitswap.notify(cid)

      expect(receivedBlockSpy.called).to.be.true()
    })
  })

  describe('wantlist', () => {
    it('should remove CIDs from the wantlist when the block arrives', async () => {
      const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
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

      const p = bitswap.want(cid)

      // wait for message send to peer
      await sentMessages.promise

      expect(bitswap.getWantlist().map(w => w.cid)).to.include(cid)

      // provider sends message
      bitswap.network.safeDispatchEvent<BitswapMessageEventDetail>('bitswap:message', {
        detail: {
          peer: remotePeer,
          message: {
            blocks: [{
              prefix: cidToPrefix(cid),
              data: block
            }],
            blockPresences: [],
            pendingBytes: 0
          }
        }
      })

      const b = await p

      expect(bitswap.getWantlist()).to.be.empty()
      expect(b).to.equalBytes(block)
    })

    it('should remove CIDs from the wantlist when the want is aborted', async () => {
      expect(bitswap.getWantlist()).to.be.empty()

      const p = bitswap.want(cid, {
        signal: AbortSignal.timeout(100)
      })

      expect(bitswap.getWantlist().map(w => w.cid)).to.include(cid)

      await expect(p).to.eventually.be.rejected
        .with.property('name', 'AbortError')

      expect(bitswap.getWantlist()).to.be.empty()
    })
  })

  describe('peer wantlist', () => {
    it('should return a peer wantlist', async () => {
      const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

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
                cid: cid.bytes,
                priority: 100
              }]
            },
            blockPresences: [],
            blocks: [],
            pendingBytes: 0
          }
        }
      })

      expect(bitswap.getPeerWantlist(remotePeer)?.map(entry => entry.cid)).to.deep.equal([cid])
    })
  })
})
