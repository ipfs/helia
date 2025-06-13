import { generateKeyPair } from '@libp2p/crypto/keys'
import { isPeerId } from '@libp2p/interface'
import { matchMultiaddr } from '@libp2p/interface-compliance-tests/matchers'
import { mockStream } from '@libp2p/interface-compliance-tests/mocks'
import { defaultLogger } from '@libp2p/logger'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import delay from 'delay'
import all from 'it-all'
import { lpStream } from 'it-length-prefixed-stream'
import { duplexPair } from 'it-pair/duplex'
import { pbStream } from 'it-protobuf-stream'
import { CID } from 'multiformats/cid'
import { pEvent } from 'p-event'
import pRetry from 'p-retry'
import Sinon from 'sinon'
import { stubInterface } from 'sinon-ts'
import { BITSWAP_120 } from '../src/constants.js'
import { Network } from '../src/network.js'
import { BitswapMessage, BlockPresenceType } from '../src/pb/message.js'
import { QueuedBitswapMessage } from '../src/utils/bitswap-message.js'
import { cidToPrefix } from '../src/utils/cid-prefix.js'
import type { Routing } from '@helia/interface/routing'
import type { Connection, Libp2p, PeerId, IdentifyResult, Stream } from '@libp2p/interface'
import type { StubbedInstance } from 'sinon-ts'

interface StubbedNetworkComponents {
  routing: StubbedInstance<Routing>
  libp2p: StubbedInstance<Libp2p>
}

describe('network', () => {
  let network: Network
  let components: StubbedNetworkComponents

  beforeEach(async () => {
    components = {
      routing: stubInterface<Routing>(),
      libp2p: stubInterface<Libp2p>({
        getConnections: () => [],
        metrics: undefined,
        isDialable: async () => true
      })
    }

    network = new Network({
      ...components,
      logger: defaultLogger()
    }, {
      messageReceiveTimeout: 100
    })

    await network.start()
  })

  afterEach(async () => {
    if (network != null) {
      await network.stop()
    }
  })

  it('should not connect if not running', async () => {
    await network.stop()

    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    await expect(network.connectTo(peerId)).to.eventually.be.rejected
      .with.property('name', 'NotStartedError')
  })

  it('should register protocol handlers', () => {
    expect(components.libp2p.handle.called).to.be.true()
    expect(components.libp2p.register.calledWith(BITSWAP_120)).to.be.true()
  })

  it('should deregister protocol handlers', async () => {
    await network.stop()

    expect(components.libp2p.unhandle.called).to.be.true()
  })

  it('should start twice', async () => {
    expect(components.libp2p.handle.calledOnce).to.be.true()

    await network.start()

    expect(components.libp2p.handle.calledOnce).to.be.true()
  })

  it('should emit a bitswap:message event when receiving an incoming message', async () => {
    const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    const connection = stubInterface<Connection>({
      remotePeer
    })
    const [localDuplex, remoteDuplex] = duplexPair<any>()
    const remoteStream = stubInterface<Stream>(remoteDuplex)
    const handler = components.libp2p.handle.getCall(0).args[1]

    const messageEventPromise = pEvent<'bitswap:message', CustomEvent<{ peer: PeerId, message: BitswapMessage }>>(network, 'bitswap:message')

    handler({
      stream: remoteStream,
      connection
    })

    const pbstr = pbStream(localDuplex).pb(BitswapMessage)
    await pbstr.write({
      blockPresences: [],
      blocks: [],
      wantlist: {
        full: true,
        entries: []
      },
      pendingBytes: 0
    })

    const event = await messageEventPromise

    expect(event.detail.peer.toString()).to.equal(remotePeer.toString())
    expect(event.detail).to.have.nested.property('message.wantlist.full', true)
  })

  it('should close the stream if parsing an incoming message fails', async () => {
    const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    const connection = stubInterface<Connection>({
      remotePeer
    })
    const [localDuplex, remoteDuplex] = duplexPair<any>()
    const remoteStream = stubInterface<Stream>(remoteDuplex)
    const handler = components.libp2p.handle.getCall(0).args[1]

    handler({
      stream: remoteStream,
      connection
    })

    const lpstr = lpStream(localDuplex)

    // garbage data, cannot be unmarshaled as protobuf
    await lpstr.write(Uint8Array.from([0, 1, 2, 3]))

    await pRetry(() => {
      expect(remoteStream.abort.called).to.be.true()
    })
  })

  it('should close the stream if no message is received', async () => {
    const remotePeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    const connection = stubInterface<Connection>({
      remotePeer
    })
    const [, remoteDuplex] = duplexPair<any>()
    const remoteStream = mockStream(remoteDuplex)
    const handler = components.libp2p.handle.getCall(0).args[1]

    const spy = Sinon.spy(remoteStream, 'abort')

    handler({
      stream: remoteStream,
      connection
    })

    await pRetry(() => {
      expect(spy.called).to.be.true()
    })
  })

  it('should find providers', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    const providers = [{
      id: peerId,
      multiaddrs: [
        multiaddr('/ip4/127.0.0.1/tcp/4001')
      ]
    }]

    components.routing.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    const output = await all(network.findProviders(cid))

    expect(output).to.have.lengthOf(1)
    expect(output[0].id.toString()).to.equal(peerId.toString())
    expect(output[0].multiaddrs).to.have.lengthOf(1)
    expect(output[0].multiaddrs[0].toString()).to.equal('/ip4/127.0.0.1/tcp/4001')
  })

  it('should ignore providers with only transient addresses', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    const providers = [{
      id: peerId,
      multiaddrs: [
        multiaddr('/ip4/127.0.0.1/tcp/4001/p2p-circuit')
      ]
    }]

    components.routing.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    components.libp2p.isDialable = Sinon.stub()
    components.libp2p.isDialable.withArgs(matchMultiaddr(providers[0].multiaddrs[0]), {
      runOnLimitedConnection: false
    })

    const output = await all(network.findProviders(cid))

    expect(output).to.be.empty()
  })

  it('should find providers with only transient addresses when running on transient connections', async () => {
    await network.stop()
    network = new Network({
      ...components,
      logger: defaultLogger()
    }, {
      runOnLimitedConnections: true
    })

    await network.start()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    const providers = [{
      id: peerId,
      multiaddrs: [
        multiaddr('/ip4/127.0.0.1/tcp/4001/p2p-circuit')
      ]
    }]

    components.routing.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    const output = await all(network.findProviders(cid))

    expect(output).to.have.lengthOf(1)
    expect(output[0].id.toString()).to.equal(peerId.toString())
    expect(output[0].multiaddrs).to.have.lengthOf(1)
    expect(output[0].multiaddrs[0].toString()).to.equal('/ip4/127.0.0.1/tcp/4001/p2p-circuit')
  })

  it('should find and connect to a peer', async () => {
    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    const providers = [{
      id: peerId,
      multiaddrs: [
        multiaddr('/ip4/127.0.0.1/tcp/4001')
      ]
    }]

    components.routing.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    components.libp2p.dial.callsFake(async (peerId) => {
      // fake a network delay
      await delay(100)

      const connection = stubInterface<Connection>()

      // simulate identify having run
      setTimeout(() => {
        const call = components.libp2p.addEventListener.getCall(0)

        expect(call.args[0]).to.equal('peer:identify')
        const callback = call.args[1]

        if (isPeerId(peerId) && typeof callback === 'function') {
          callback(new CustomEvent<IdentifyResult>('peer:identify', {
            detail: {
              peerId,
              protocols: [
                BITSWAP_120
              ],
              listenAddrs: [],
              connection
            }
          }))
        }
      }, 100)

      return connection
    })

    await network.findAndConnect(cid)

    expect(components.libp2p.dial.calledWith(peerId)).to.be.true()
  })

  it('should find and connect to a peer with only a transient address when running on transient connections', async () => {
    await network.stop()
    network = new Network({
      ...components,
      logger: defaultLogger()
    }, {
      runOnLimitedConnections: true
    })
    await network.start()

    const cid = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))

    const providers = [{
      id: peerId,
      multiaddrs: [
        multiaddr('/ip4/127.0.0.1/tcp/4001/p2p-circuit')
      ]
    }]

    components.routing.findProviders.withArgs(cid).returns((async function * () {
      yield * providers
    })())

    components.libp2p.dial.callsFake(async (peerId) => {
      // fake a network delay
      await delay(100)

      const connection = stubInterface<Connection>()

      // simulate identify having run
      setTimeout(() => {
        const call = components.libp2p.addEventListener.getCall(0)

        expect(call.args[0]).to.equal('peer:identify')
        const callback = call.args[1]

        if (isPeerId(peerId) && typeof callback === 'function') {
          callback(new CustomEvent<IdentifyResult>('peer:identify', {
            detail: {
              peerId,
              protocols: [
                BITSWAP_120
              ],
              listenAddrs: [],
              connection
            }
          }))
        }
      }, 100)

      return connection
    })

    await network.findAndConnect(cid)

    expect(components.libp2p.dial.calledWith(peerId)).to.be.true()
  })

  it('should send a message', async () => {
    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    const [localDuplex, remoteDuplex] = duplexPair<any>()
    const remoteStream = stubInterface<Stream>(remoteDuplex)

    components.libp2p.dialProtocol.withArgs(peerId, BITSWAP_120).resolves(remoteStream)

    void network.sendMessage(peerId, new QueuedBitswapMessage(true))

    const pbstr = pbStream(localDuplex).pb(BitswapMessage)
    const message = await pbstr.read()

    expect(message).to.have.nested.property('wantlist.full').that.is.true()
  })

  it('should merge messages sent to the same peer', async () => {
    await network.stop()
    network = new Network({
      ...components,
      logger: defaultLogger()
    }, {
      messageSendConcurrency: 1
    })
    await network.start()

    const peerId = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    const [localDuplex, remoteDuplex] = duplexPair<any>()
    const remoteStream = stubInterface<Stream>(remoteDuplex)

    components.libp2p.dialProtocol.withArgs(peerId, BITSWAP_120).resolves(remoteStream)

    const cid1 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3A')
    const cid2 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3B')
    const cid3 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3C')
    const cid4 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3D')
    const cid5 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3E')
    const cid6 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3F')
    const cid7 = CID.parse('QmaQwYWpchozXhFv8nvxprECWBSCEppN9dfd2VQiJfRo3G')

    const messageA = new QueuedBitswapMessage(true)
    messageA.addBlock(cid1, {
      prefix: cidToPrefix(cid1),
      data: Uint8Array.from([0, 1, 2, 3, 4])
    })
    messageA.addBlockPresence(cid3, {
      cid: cid3.bytes,
      type: BlockPresenceType.DoNotHaveBlock
    })
    messageA.addBlockPresence(cid5, {
      cid: cid5.bytes,
      type: BlockPresenceType.DoNotHaveBlock
    })
    messageA.addWantlistEntry(cid5, {
      cid: cid5.bytes,
      priority: 5
    })
    messageA.addWantlistEntry(cid6, {
      cid: cid6.bytes,
      priority: 100
    })
    messageA.pendingBytes = 5

    const messageB = new QueuedBitswapMessage()
    messageB.addBlock(cid2, {
      prefix: cidToPrefix(cid2),
      data: Uint8Array.from([5, 6, 7, 8])
    })
    messageB.addBlockPresence(cid4, {
      cid: cid4.bytes,
      type: BlockPresenceType.DoNotHaveBlock
    })
    messageB.addBlockPresence(cid5, {
      cid: cid5.bytes,
      type: BlockPresenceType.HaveBlock
    })
    messageB.addWantlistEntry(cid6, {
      cid: cid6.bytes,
      priority: 0
    })
    messageB.addWantlistEntry(cid7, {
      cid: cid7.bytes,
      priority: 0
    })
    messageB.pendingBytes = 7

    // block the queue with a slow request
    const slowPeer = peerIdFromPrivateKey(await generateKeyPair('Ed25519'))
    components.libp2p.dialProtocol.withArgs(slowPeer).callsFake(async () => {
      await delay(100)
      throw new Error('Urk!')
    })

    const messageC = new QueuedBitswapMessage()
    messageC.addBlock(cid1, {
      prefix: cidToPrefix(cid1),
      data: Uint8Array.from([0, 1, 2, 3, 4])
    })

    void network.sendMessage(slowPeer, messageC)
      .catch(() => {})

    // send two messages while the queue is blocked
    void network.sendMessage(peerId, messageA)
    void network.sendMessage(peerId, messageB)

    // wait for long enough that we are sure we don't dial peerId twice
    await delay(500)

    // one dial for slowPeer, one for peerId
    expect(components.libp2p.dialProtocol).to.have.property('callCount', 2, 'made too many dials')

    const pbstr = pbStream(localDuplex).pb(BitswapMessage)
    const message = await pbstr.read()

    expect([...message.blocks.values()]).to.deep.equal([{
      prefix: cidToPrefix(cid1),
      data: Uint8Array.from([0, 1, 2, 3, 4])
    }, {
      prefix: cidToPrefix(cid2),
      data: Uint8Array.from([5, 6, 7, 8])
    }])
    expect(message).to.have.deep.property('blockPresences', [{
      cid: cid3.bytes,
      type: BlockPresenceType.DoNotHaveBlock
    }, {
      cid: cid5.bytes,
      type: BlockPresenceType.HaveBlock
    }, {
      cid: cid4.bytes,
      type: BlockPresenceType.DoNotHaveBlock
    }])
    expect(message).to.have.deep.property('wantlist', {
      full: true,
      entries: [{
        cid: cid5.bytes,
        priority: 5
      }, {
        cid: cid6.bytes,
        priority: 100
      }, {
        cid: cid7.bytes,
        priority: 0
      }]
    })
  })
})
