/* eslint-env mocha */

import { ipns } from '@helia/ipns'
import { libp2p } from '@helia/ipns/routing'
import { identify } from '@libp2p/identify'
import { kadDHT, removePublicAddressesMapper, type KadDHT } from '@libp2p/kad-dht'
import { keychain, type Keychain } from '@libp2p/keychain'
import { peerIdFromString } from '@libp2p/peer-id'
import { createEd25519PeerId, createRSAPeerId, createSecp256k1PeerId } from '@libp2p/peer-id-factory'
import { expect } from 'aegir/chai'
import { ipnsSelector } from 'ipns/selector'
import { ipnsValidator } from 'ipns/validator'
import last from 'it-last'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { isElectronMain } from 'wherearewe'
import { connect } from './fixtures/connect.js'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { sortClosestPeers } from './fixtures/create-peer-ids.js'
import { keyTypes } from './fixtures/key-types.js'
import { waitFor } from './fixtures/wait-for.js'
import type { Helia } from '@helia/interface'
import type { IPNS } from '@helia/ipns'
import type { Libp2p, PeerId } from '@libp2p/interface'
import type { Controller } from 'ipfsd-ctl'

keyTypes.forEach(type => {
  describe(`libp2p routing with ${type} keys`, () => {
    let helia: Helia<Libp2p<{ dht: KadDHT, keychain: Keychain }>>
    let kubo: Controller
    let name: IPNS

    // the CID we are going to publish
    let value: CID

    // the public key we will use to publish the value
    let key: PeerId

    /**
     * Ensure that for the CID we are going to publish, the resolver has a peer ID that
     * is KAD-closer to the routing key so we can predict the the resolver will receive
     * the DHT record containing the IPNS record
     */
    async function createNodes (resolver: 'kubo' | 'helia'): Promise<void> {
      const input = Uint8Array.from([0, 1, 2, 3, 4])
      const digest = await sha256.digest(input)
      value = CID.createV1(raw.code, digest)

      helia = await createHeliaNode({
        services: {
          identify: identify(),
          dht: kadDHT({
            validators: {
              ipns: ipnsValidator
            },
            selectors: {
              ipns: ipnsSelector
            },
            // skips waiting for the initial self-query to find peers
            allowQueryWithZeroPeers: true,

            // use lan-only mode
            protocol: '/ipfs/lan/kad/1.0.0',
            peerInfoMapper: removePublicAddressesMapper,
            clientMode: false
          }),
          keychain: keychain()
        }
      })
      kubo = await createKuboNode()

      // find a PeerId that is KAD-closer to the resolver than the publisher when used as an IPNS key
      while (true) {
        if (type === 'Ed25519') {
          key = await createEd25519PeerId()
        } else if (type === 'secp256k1') {
          key = await createSecp256k1PeerId()
        } else {
          key = await createRSAPeerId()
        }

        const routingKey = uint8ArrayConcat([
          uint8ArrayFromString('/ipns/'),
          key.toBytes()
        ])

        const [closest] = await sortClosestPeers(routingKey, [
          helia.libp2p.peerId,
          peerIdFromString(kubo.peer.id.toString())
        ])

        if (resolver === 'kubo' && closest.equals(peerIdFromString(kubo.peer.id.toString()))) {
          break
        }

        if (resolver === 'helia' && closest.equals(helia.libp2p.peerId)) {
          break
        }
      }

      // connect the two nodes over the KAD-DHT protocol, this should ensure
      // both nodes have each other in their KAD buckets
      await connect(helia, kubo, '/ipfs/lan/kad/1.0.0')

      await waitFor(async () => {
        let found = false

        for await (const event of helia.libp2p.services.dht.findPeer(peerIdFromString(kubo.peer.id.toString()))) {
          if (event.name === 'FINAL_PEER') {
            found = true
          }
        }

        return found
      }, {
        timeout: 30000,
        delay: 1000,
        message: 'Helia could not find Kubo on the DHT'
      })

      await waitFor(async () => {
        let found = false

        // @ts-expect-error kubo deps are out of date
        for await (const event of kubo.api.dht.findPeer(helia.libp2p.peerId)) {
          if (event.name === 'FINAL_PEER') {
            found = true
          }
        }

        return found
      }, {
        timeout: 30000,
        delay: 1000,
        message: 'Kubo could not find Helia on the DHT'
      })

      name = ipns(helia, {
        routers: [
          libp2p(helia)
        ]
      })
    }

    afterEach(async () => {
      if (helia != null) {
        await helia.stop()
      }

      if (kubo != null) {
        await kubo.stop()
      }
    })

    it(`should publish on helia and resolve on kubo using a ${type} key`, async () => {
      await createNodes('kubo')

      const keyName = 'my-ipns-key'
      await helia.libp2p.services.keychain.importPeer(keyName, key)

      await name.publish(key, value)

      const resolved = await last(kubo.api.name.resolve(key.toString()))

      if (resolved == null) {
        throw new Error('kubo failed to resolve name')
      }

      expect(resolved).to.equal(`/ipfs/${value.toString()}`)
    })

    it('should publish on kubo and resolve on helia', async function () {
      if (isElectronMain) {
        // electron main does not have fetch, FormData or Blob APIs
        // can revisit when kubo-rpc-client supports the key.import API
        return this.skip()
      }

      if (type === 'secp256k1') {
        // Kubo cannot import secp256k1 keys
        return this.skip()
      }

      await createNodes('helia')

      const keyName = 'my-ipns-key'
      const { cid } = await kubo.api.add(Uint8Array.from([0, 1, 2, 3, 4]))

      // ensure the key is in the kubo keychain so we can use it to publish the IPNS record
      const body = new FormData()
      body.append('key', new Blob([key.privateKey ?? new Uint8Array(0)]))

      // can't use the kubo-rpc-api for this call yet
      const response = await fetch(`http://${kubo.api.apiHost}:${kubo.api.apiPort}/api/v0/key/import?arg=${keyName}`, {
        method: 'POST',
        body
      })

      expect(response).to.have.property('status', 200)

      await kubo.api.name.publish(cid, {
        key: keyName
      })

      const resolvedCid = await name.resolve(key)
      expect(resolvedCid.toString()).to.equal(cid.toString())
    })
  })
})
