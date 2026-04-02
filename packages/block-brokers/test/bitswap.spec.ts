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
import { TrustlessGatewayBlockBroker } from '../src/trustless-gateway/broker.ts'
import { TrustlessGateway } from '../src/trustless-gateway/trustless-gateway.ts'
import type { BlockBroker, HasherLoader, Routing } from '@helia/interface'
import type { StubbedInstance } from 'sinon-ts'
import { type Connection, start, type Libp2p, type Provider } from '@libp2p/interface'
import type { Blockstore } from 'interface-blockstore'
import { bitswap } from '../src/bitswap.ts'
import { multiaddrConnectionPair, streamPair } from '@libp2p/utils'
import * as raw from 'multiformats/codecs/raw'
import { BitswapMessage } from '../../bitswap/src/pb/message.ts'
import { cidToPrefix } from '../../bitswap/src/utils/cid-prefix.ts'

describe('bitswap-block-broker', () => {
  let bitswapBlockBroker: BlockBroker
  let routing: StubbedInstance<Required<Routing>>
  let cid: CID
  let libp2p: StubbedInstance<Libp2p>
  let blockstore: StubbedInstance<Blockstore>
  let getHasher: HasherLoader
  let badPeer: Provider
  let goodPeer: Provider
  let block: Uint8Array

  beforeEach(async () => {
    block = Uint8Array.from([0, 1, 2, 3, 4])
    const hash = await sha256.digest(block)
    cid = CID.createV1(raw.code, hash)

    routing = stubInterface()
    libp2p = stubInterface()
    blockstore = stubInterface()

    getHasher = () => {
      return sha256
    }

    badPeer = {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.BAD_TRUSTLESS_GATEWAY ?? '')
      ],
      routing: 'test-routing'
    }
    goodPeer = {
      id: peerIdFromPrivateKey(await generateKeyPair('Ed25519')),
      multiaddrs: [
        uriToMultiaddr(process.env.TRUSTLESS_GATEWAY ?? '')
      ],
      routing: 'test-routing'
    }

    libp2p.getConnections.returns([])

    bitswapBlockBroker = bitswap()({
      libp2p,
      blockstore,
      routing,
      logger: defaultLogger(),
      getHasher
    })

    await start(bitswapBlockBroker)
  })

  it.only('should notify of progress during find providers', async function () {
    routing.findProviders.callsFake(async function * () {
      yield goodPeer
    })

    libp2p.isDialable.resolves(true)

    const handler = libp2p.handle.getCall(0).args[1]

    const [outboundStream, inboundStream] = await streamPair()
    libp2p.dialProtocol.withArgs(goodPeer.id).resolves(outboundStream)

    inboundStream.addEventListener('message', (buf) => {
      console.info(buf)

      // send the block back
      Promise.resolve().then(async () => {
        const [outboundStream, inboundStream] = await streamPair()

        handler(inboundStream, stubInterface<Connection>())

        outboundStream.send(BitswapMessage.encode({
          blocks: [{
            prefix: cidToPrefix(cid),
            data: block
          }]
        }))
      })
    })

    // goodPeer is connected
    const onConnect = libp2p.register.getCall(0).args[1].onConnect
    onConnect?.(goodPeer.id, stubInterface<Connection>())

    const events = new Map<string, number>()

    await bitswapBlockBroker.retrieve?.(cid, {
      onProgress: (evt) => {
        let count = events.get(evt.type) ?? 0
        count++
        events.set(evt.type, count)
      }
    })

    expect(events.get('helia:block-broker:connect')).to.equal(1)
    expect(events.get('helia:block-broker:connected')).to.equal(1)
    expect(events.get('helia:block-broker:request-block')).to.equal(1)
    expect(events.get('helia:block-broker:receive-block')).to.equal(1)
  })
})
