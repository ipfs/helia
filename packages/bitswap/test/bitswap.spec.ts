import { DEFAULT_SESSION_MAX_PROVIDERS, DEFAULT_SESSION_MIN_PROVIDERS } from '@helia/interface'
import { start, stop } from '@libp2p/interface'
import { matchPeerId } from '@libp2p/interface-compliance-tests/matchers'
import { mockStream } from '@libp2p/interface-compliance-tests/mocks'
import { defaultLogger } from '@libp2p/logger'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import { MemoryBlockstore } from 'blockstore-core'
import delay from 'delay'
import { duplexPair } from 'it-pair/duplex'
import { pbStream } from 'it-protobuf-stream'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import pDefer from 'p-defer'
import pWaitFor from 'p-wait-for'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { Bitswap } from '../src/bitswap.js'
import { BitswapMessage, BlockPresenceType } from '../src/pb/message.js'
import { cidToPrefix } from '../src/utils/cid-prefix.js'
import type { BitswapMessageEventDetail } from '../src/network.js'
import type { Routing } from '@helia/interface/routing'
import type { Connection, Libp2p, PeerId } from '@libp2p/interface'
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
      peerId: await createEd25519PeerId(),
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

  describe('session', () => {
    it('should create a session', async () => {
      const connectedPeer = await createEd25519PeerId()

      // notify topology of connected peer that supports bitswap
      components.libp2p.register.getCall(0).args[1]?.onConnect?.(connectedPeer, stubInterface<Connection>({
        remotePeer: connectedPeer
      }))

      // the current peer does not have the block
      stubPeerResponse(components.libp2p, connectedPeer, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      // providers found via routing
      const providers = await Promise.all(
        new Array(10).fill(0).map(async (_, i) => {
          return {
            id: await createEd25519PeerId(),
            multiaddrs: [
              multiaddr(`/ip4/4${i}.4${i}.4${i}.4${i}/tcp/${1234 + i}`)
            ]
          }
        })
      )

      components.routing.findProviders.withArgs(cid).returns((async function * () {
        yield * providers
      })())

      // stub first three provider responses, all but #3 have the block, second
      // provider sends the block in the response
      stubPeerResponse(components.libp2p, providers[0].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.HaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })
      stubPeerResponse(components.libp2p, providers[1].id, {
        blockPresences: [],
        blocks: [{
          prefix: cidToPrefix(cid),
          data: block
        }],
        pendingBytes: 0
      })
      stubPeerResponse(components.libp2p, providers[2].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })
      stubPeerResponse(components.libp2p, providers[3].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.HaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })
      stubPeerResponse(components.libp2p, providers[4].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.HaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })
      stubPeerResponse(components.libp2p, providers[5].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.HaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      const session = await bitswap.createSession(cid)
      expect(session.peers.size).to.equal(DEFAULT_SESSION_MIN_PROVIDERS)
      expect([...session.peers].map(p => p.toString())).to.include(providers[0].id.toString())

      // dialed connected peer first
      expect(connectedPeer.equals(components.libp2p.dialProtocol.getCall(0).args[0].toString())).to.be.true()

      // dialed first provider second
      expect(providers[0].id.equals(components.libp2p.dialProtocol.getCall(1).args[0].toString())).to.be.true()

      // the query continues after the session is ready
      await pWaitFor(() => {
        return session.peers.size === DEFAULT_SESSION_MAX_PROVIDERS
      })

      // should have continued querying until we reach DEFAULT_SESSION_MAX_PROVIDERS
      expect(providers[1].id.equals(components.libp2p.dialProtocol.getCall(2).args[0].toString())).to.be.true()
      expect(providers[2].id.equals(components.libp2p.dialProtocol.getCall(3).args[0].toString())).to.be.true()

      // should have stopped at DEFAULT_SESSION_MAX_PROVIDERS
      expect(session.peers.size).to.equal(DEFAULT_SESSION_MAX_PROVIDERS)
    })

    it('should error when creating a session when no peers or providers have the block', async () => {
      const connectedPeer = await createEd25519PeerId()

      // notify topology of connected peer that supports bitswap
      components.libp2p.register.getCall(0).args[1]?.onConnect?.(connectedPeer, stubInterface<Connection>({
        remotePeer: connectedPeer
      }))

      // the current peer does not have the block
      stubPeerResponse(components.libp2p, connectedPeer, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      // providers found via routing
      const providers = [{
        id: await createEd25519PeerId(),
        multiaddrs: [
          multiaddr('/ip4/41.41.41.41/tcp/1234')
        ]
      }]

      components.routing.findProviders.withArgs(cid).returns((async function * () {
        yield * providers
      })())

      // the provider doesn't have the block
      stubPeerResponse(components.libp2p, providers[0].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      await expect(bitswap.createSession(cid)).to.eventually.be.rejected
        .with.property('code', 'ERR_NO_PROVIDERS_FOUND')
    })

    it('should error when creating a session when no providers have the block', async () => {
      // providers found via routing
      const providers = [{
        id: await createEd25519PeerId(),
        multiaddrs: [
          multiaddr('/ip4/41.41.41.41/tcp/1234')
        ]
      }]

      components.routing.findProviders.withArgs(cid).returns((async function * () {
        yield * providers
      })())

      // the provider doesn't have the block
      stubPeerResponse(components.libp2p, providers[0].id, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      await expect(bitswap.createSession(cid)).to.eventually.be.rejected
        .with.property('code', 'ERR_NO_PROVIDERS_FOUND')
    })

    it('should error when creating a session when no peers have the block', async () => {
      const connectedPeer = await createEd25519PeerId()

      // notify topology of connected peer that supports bitswap
      components.libp2p.register.getCall(0).args[1]?.onConnect?.(connectedPeer, stubInterface<Connection>({
        remotePeer: connectedPeer
      }))

      // the current peer does not have the block
      stubPeerResponse(components.libp2p, connectedPeer, {
        blockPresences: [{
          cid: cid.bytes,
          type: BlockPresenceType.DontHaveBlock
        }],
        blocks: [],
        pendingBytes: 0
      })

      components.routing.findProviders.withArgs(cid).returns((async function * () {})())

      await expect(bitswap.createSession(cid)).to.eventually.be.rejected
        .with.property('code', 'ERR_NO_PROVIDERS_FOUND')
    })

    it('should error when creating a session when there are peers and no providers found', async () => {
      components.routing.findProviders.withArgs(cid).returns((async function * () {})())

      await expect(bitswap.createSession(cid)).to.eventually.be.rejected
        .with.property('code', 'ERR_NO_PROVIDERS_FOUND')
    })
  })

  describe('want', () => {
    it('should want a block that is available on the network', async () => {
      const remotePeer = await createEd25519PeerId()
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
        .with.property('code', 'ABORT_ERR')
    })

    it('should notify peers we have a block', async () => {
      const receivedBlockSpy = Sinon.spy(bitswap.peerWantLists, 'receivedBlock')

      await bitswap.notify(cid, block)

      expect(receivedBlockSpy.called).to.be.true()
    })
  })

  describe('wantlist', () => {
    it('should remove CIDs from the wantlist when the block arrives', async () => {
      const remotePeer = await createEd25519PeerId()
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
        .with.property('code', 'ABORT_ERR')

      expect(bitswap.getWantlist()).to.be.empty()
    })
  })

  describe('peer wantlist', () => {
    it('should return a peer wantlist', async () => {
      const remotePeer = await createEd25519PeerId()

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

function stubPeerResponse (libp2p: StubbedInstance<Libp2p>, peerId: PeerId, response: BitswapMessage): void {
  const [localDuplex, remoteDuplex] = duplexPair<any>()
  const localStream = mockStream(localDuplex)
  const remoteStream = mockStream(remoteDuplex)

  libp2p.dialProtocol.withArgs(matchPeerId(peerId)).resolves(remoteStream)

  const connection = stubInterface<Connection>({
    remotePeer: peerId
  })

  const pbstr = pbStream(localStream).pb(BitswapMessage)
  void pbstr.read().then(async message => {
    // simulate network latency
    await delay(10)

    // after reading message from remote, open a new stream on the remote and
    // send the response
    const [localDuplex, remoteDuplex] = duplexPair<any>()
    const localStream = mockStream(localDuplex)
    const remoteStream = mockStream(remoteDuplex)

    const onStream = libp2p.handle.getCall(0).args[1]
    onStream({ stream: remoteStream, connection })

    const pbstr = pbStream(localStream).pb(BitswapMessage)
    await pbstr.write(response)
  })
}
