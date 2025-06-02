import { generateKeyPair } from '@libp2p/crypto/keys'
import { start, stop } from '@libp2p/interface'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import pRetry from 'p-retry'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { Bitswap } from '../src/bitswap.js'
import { cidToPrefix } from '../src/utils/cid-prefix.js'
import type { BitswapMessageEventDetail } from '../src/network.js'
import type { WantBlockResult } from '../src/want-list.js'
import type { Routing } from '@helia/interface/routing'
import type { Libp2p, PeerId } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import type { StubbedInstance } from 'sinon-ts'
import delay from 'delay'

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
    it('should call wantList.wantBlock and network.findAndConnect concurrently and abort findAndConnect on completion', async () => {
      const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
      let findAndConnectSignal: AbortSignal | undefined // To capture the signal

      // --- Setup Stubs/Mocks ---
      // Stub findAndConnect - we don't need it to resolve, just capture args
      const findAndConnectStub = Sinon.stub(bitswap.network, 'findAndConnect')
      // Prevent the stubbed method from hanging indefinitely if called unexpectedly after the test logic finishes
      findAndConnectStub.returns(Promise.resolve()) // Or reject with AbortError if preferred
      // Capture the signal passed to findAndConnect
      findAndConnectStub.callsFake(async (_cid, options) => {
        findAndConnectSignal = options?.signal
        // Return a promise that never resolves on its own,
        // relying on the signal for abortion
        return new Promise(() => {})
      })

      // Stub wantBlock and make it return a deferred promise
      const blockDeferred = pDefer<WantBlockResult>()
      const wantBlockStub = Sinon.stub(bitswap.wantList, 'wantBlock').returns(blockDeferred.promise)

      // --- Execution ---
      const wantPromise = bitswap.want(cid)

      // --- Assertions ---
      // Give the event loop a chance to run the concurrent calls
      await delay(20) // Increased delay slightly just in case

      expect(wantBlockStub.calledOnce).to.be.true('wantList.wantBlock should have been called once')
      expect(findAndConnectStub.calledOnce).to.be.true('network.findAndConnect should have been called once')

      // Verify arguments
      expect(wantBlockStub.getCall(0).args[0].toString()).to.equal(cid.toString())
      expect(findAndConnectStub.getCall(0).args[0].toString()).to.equal(cid.toString())
      expect(wantBlockStub.getCall(0).args[1]?.signal).to.be.an.instanceOf(AbortSignal)
      expect(findAndConnectStub.getCall(0).args[1]?.signal).to.be.an.instanceOf(AbortSignal)
      expect(findAndConnectSignal).to.be.an.instanceOf(AbortSignal, 'Signal should have been captured from findAndConnect call')

      // --- Resolution ---
      // Simulate block arrival
      blockDeferred.resolve({
        sender: remotePeer,
        cid,
        block
      })

      // Await the main want promise
      const resultBlock = await wantPromise
      expect(resultBlock).to.equalBytes(block)

      // --- Final Assertion ---
      // Check that the signal passed to findAndConnect is now aborted
      // Add a small delay to ensure the abort controller within `want` has executed
      await delay(10)
      expect(findAndConnectSignal?.aborted).to.be.true('Signal passed to findAndConnect should be aborted after want completes')
    })

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

      await bitswap.notify(cid, block)

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
