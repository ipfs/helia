import { ipns } from '@helia/ipns'
import { peerIdFromString } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import last from 'it-last'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { isElectronMain } from 'wherearewe'
import { connect } from './fixtures/connect.ts'
import { createHeliaNode } from './fixtures/create-helia.ts'
import { createKuboNode } from './fixtures/create-kubo.ts'
import { sortClosestPeers } from './fixtures/create-peer-ids.ts'
import { keyTypes } from './fixtures/key-types.ts'
import { waitFor } from './fixtures/wait-for.ts'
import type { PrivateKey } from '@helia/interface'
import type { IPNS } from '@helia/ipns'
import type { HeliaWithLibp2p } from '@helia/libp2p'
import type { KuboNode } from 'ipfsd-ctl'
import type { MultihashDigest } from 'multiformats/cid'

function multihashToIPNSRoutingKey (digest: MultihashDigest): Uint8Array<ArrayBuffer> {
  return uint8ArrayConcat([
    uint8ArrayFromString('/ipns/'),
    digest.bytes
  ])
}

keyTypes.forEach(type => {
  describe(`@helia/ipns - default routing with ${type} keys`, () => {
    let helia: HeliaWithLibp2p
    let kubo: KuboNode
    let name: IPNS

    // the CID we are going to publish
    let value: CID

    // the key we will use to publish the value
    let key: PrivateKey

    /**
     * Ensure that for the CID we are going to publish, the resolver has a peer ID that
     * is KAD-closer to the routing key so we can predict the the resolver will receive
     * the DHT record containing the IPNS record
     */
    async function createNodes (resolver: 'kubo' | 'helia'): Promise<void> {
      const input = Uint8Array.from([0, 1, 2, 3, 4])
      const digest = await sha256.digest(input)
      value = CID.createV1(raw.code, digest)

      helia = await createHeliaNode()
      kubo = await createKuboNode()

      // find a key that is KAD-closer to the resolver than the publisher when
      // used as an IPNS key
      while (true) {
        await helia.keychain.removeKey('test-key')
        key = await helia.keychain.generateKey('test-key', {
          type
        })
        await helia.keychain.removeKey('test-key')

        const routingKey = multihashToIPNSRoutingKey(key.publicKey.toMultihash())

        const [closest] = await sortClosestPeers(routingKey, [
          helia.libp2p.peerId,
          peerIdFromString((await kubo.api.id()).id.toString())
        ])

        if (resolver === 'kubo' && closest.equals(peerIdFromString((await kubo.api.id()).id.toString()))) {
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

        for await (const event of helia.libp2p.services.dht.findPeer(peerIdFromString((await kubo.api.id()).id.toString()))) {
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

        for await (const event of kubo.api.routing.findPeer(helia.libp2p.peerId)) {
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

      name = ipns(helia)
    }

    afterEach(async () => {
      if (helia != null) {
        await helia.stop()
      }

      if (kubo != null) {
        await kubo.stop()
      }
    })

    it('should publish on helia and resolve on kubo', async () => {
      await createNodes('kubo')

      const keyName = 'my-ipns-key'
      const privateKey = await helia.keychain.generateKey(keyName)
      await name.publish(keyName, value)

      const resolved = await last(kubo.api.name.resolve(privateKey.publicKey.toString()))

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
      body.append('key', new Blob([key.toProtobuf()]))

      // can't use the kubo-rpc-api for this call yet
      const config = kubo.api.getEndpointConfig()
      const response = await fetch(`http://${config.host}:${config.port}${config.pathname}/key/import?arg=${keyName}`, {
        method: 'POST',
        body
      })

      expect(response).to.have.property('status', 200)

      const json = await response.json()
      expect(json.Id).to.equal(key.publicKey.toCID().toString(base36), 'did not import key correctly')

      await kubo.api.name.publish(cid, {
        key: keyName,
        ttl: '1h'
      })

      const result = await last(name.resolve(key.publicKey))

      if (result == null) {
        throw new Error('No result found')
      }

      expect(result.value).to.equal(`/ipfs/${cid}`)
    })
  })
})
