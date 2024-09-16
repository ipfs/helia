/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */

import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { ipns } from '@helia/ipns'
import { pubsub } from '@helia/ipns/routing'
import { hasCode } from '@helia/utils'
import { generateKeyPair } from '@libp2p/crypto/keys'
import { peerIdFromCID } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import last from 'it-last'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { connect } from './fixtures/connect.js'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { keyTypes } from './fixtures/key-types.js'
import { waitFor } from './fixtures/wait-for.js'
import type { IPNS, ResolveResult } from '@helia/ipns'
import type { Libp2p, PubSub } from '@libp2p/interface'
import type { Keychain } from '@libp2p/keychain'
import type { HeliaLibp2p } from 'helia'
import type { KuboNode } from 'ipfsd-ctl'

// skip RSA tests because we need the DHT enabled to find the public key
// component of the keypair, but that means we can't test pubsub
// resolution because Kubo will use the DHT as well
keyTypes.filter(keyType => keyType !== 'RSA').forEach(keyType => {
  describe(`@helia/ipns - pubsub routing with ${keyType} keys`, () => {
    let helia: HeliaLibp2p<Libp2p<{ pubsub: PubSub, keychain: Keychain }>>
    let kubo: KuboNode
    let name: IPNS

    beforeEach(async () => {
      helia = await createHeliaNode({
        services: {
          pubsub: gossipsub()
        }
      })
      kubo = await createKuboNode()

      // connect the two nodes
      await connect(helia, kubo, '/meshsub/1.1.0')

      name = ipns(helia, {
        routers: [
          pubsub(helia)
        ]
      })
    })

    afterEach(async () => {
      if (helia != null) {
        await helia.stop()
      }

      if (kubo != null) {
        await kubo.stop()
      }
    })

    it('should publish on helia and resolve on kubo', async () => {
      const input = Uint8Array.from([0, 1, 2, 3, 4])
      const digest = await sha256.digest(input)
      const cid = CID.createV1(raw.code, digest)

      const privateKey = await generateKeyPair('Ed25519')

      // first call to pubsub resolver will fail but we should trigger
      // subscribing pubsub for updates
      await expect(last(kubo.api.name.resolve(privateKey.publicKey.toString(), {
        timeout: 100
      }))).to.eventually.be.undefined()

      // wait for kubo to be subscribed to updates
      const kuboSubscriptionName = `/ipns/${privateKey.publicKey.toCID().toString(base36)}`
      await waitFor(async () => {
        const subs = await kubo.api.name.pubsub.subs()
        return subs.includes(kuboSubscriptionName)
      }, {
        timeout: 30000,
        message: 'Kubo did not register for record updates'
      })

      // wait for helia to see that kubo is subscribed to the topic for record updates
      const heliaSubscriptionName = `/record/${uint8ArrayToString(uint8ArrayConcat([
        uint8ArrayFromString('/ipns/'),
        privateKey.publicKey.toMultihash().bytes
      ]), 'base64url')}`
      const kuboPeerId = (await kubo.api.id()).id.toString()
      await waitFor(async () => {
        const peers = helia.libp2p.services.pubsub.getSubscribers(heliaSubscriptionName)
        return peers.map(p => p.toString()).includes(kuboPeerId)
      }, {
        timeout: 30000,
        message: 'Helia did not see that Kubo was registered for record updates'
      })

      // publish should now succeed
      await name.publish(privateKey, cid)

      // kubo should now be able to resolve IPNS name instantly
      const resolved = await last(kubo.api.name.resolve(privateKey.publicKey.toString(), {
        timeout: 100
      }))

      expect(resolved).to.equal(`/ipfs/${cid.toString()}`)
    })

    it('should publish on kubo and resolve on helia', async function () {
      if (keyType === 'secp256k1') {
        // Kubo cannot generate secp256k1 keys
        return this.skip()
      }

      const keyName = 'my-ipns-key'
      const { cid } = await kubo.api.add(Uint8Array.from([0, 1, 2, 3, 4]))
      const result = await kubo.api.key.gen(keyName, {
        // @ts-expect-error kubo needs this in lower case
        type: keyType.toLowerCase()
      })

      // the generated id is libp2p-key CID with the public key as an identity multihash
      const peerCid = CID.parse(result.id, base36)
      const peerId = peerIdFromCID(peerCid)

      if (!hasCode(peerCid.multihash, 0)) {
        throw new Error('Incorrect hash type')
      }

      // first call to pubsub resolver should fail but we should now be subscribed for updates
      await expect(name.resolve(peerCid.multihash)).to.eventually.be.rejected()

      // actual pubsub subscription name
      const subscriptionName = `/record/${uint8ArrayToString(uint8ArrayConcat([
        uint8ArrayFromString('/ipns/'),
        peerId.toMultihash().bytes
      ]), 'base64url')}`

      // wait for helia to be subscribed to the topic for record updates
      await waitFor(async () => {
        return helia.libp2p.services.pubsub.getTopics().includes(subscriptionName)
      }, {
        timeout: 30000,
        message: 'Helia did not register for record updates'
      })

      // wait for kubo to see that helia is subscribed to the topic for record updates
      await waitFor(async () => {
        const peers = await kubo.api.pubsub.peers(subscriptionName)

        return peers.map(p => p.toString()).includes(helia.libp2p.peerId.toString())
      }, {
        timeout: 30000,
        message: 'Kubo did not see that Helia was registered for record updates'
      })

      // now publish, this should cause a pubsub message on the topic for record updates
      await kubo.api.name.publish(cid, {
        key: keyName
      })

      let resolveResult: ResolveResult | undefined

      // we should get an update eventually
      await waitFor(async () => {
        try {
          resolveResult = await name.resolve(peerId.toMultihash())

          return true
        } catch {
          return false
        }
      }, {
        timeout: 10000,
        message: 'Helia could not resolve the IPNS record'
      })

      if (resolveResult == null) {
        throw new Error('Failed to resolve CID')
      }

      expect(resolveResult.cid.toString()).to.equal(cid.toString())
    })
  })
})
