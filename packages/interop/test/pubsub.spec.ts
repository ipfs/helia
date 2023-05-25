/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */

import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { ipns } from '@helia/ipns'
import { pubsub } from '@helia/ipns/routing'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { expect } from 'aegir/chai'
import last from 'it-last'
import { identifyService } from 'libp2p/identify'
import { base36 } from 'multiformats/bases/base36'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { identity } from 'multiformats/hashes/identity'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { connect } from './fixtures/connect.js'
import { createHeliaNode } from './fixtures/create-helia.js'
import { createKuboNode } from './fixtures/create-kubo.js'
import { keyTypes } from './fixtures/key-types.js'
import { waitFor } from './fixtures/wait-for.js'
import type { Helia } from '@helia/interface'
import type { IPNS } from '@helia/ipns'
import type { PubSub } from '@libp2p/interface-pubsub'
import type { Controller } from 'ipfsd-ctl'
import type { Libp2p } from 'libp2p'

const LIBP2P_KEY_CODEC = 0x72

// skip RSA tests because we need the DHT enabled to find the public key
// component of the keypair, but that means we can't test pubsub
// resolution because Kubo will use the DHT as well
keyTypes.filter(keyType => keyType !== 'RSA').forEach(keyType => {
  describe(`pubsub routing with ${keyType} keys`, () => {
    let helia: Helia<Libp2p<{ pubsub: PubSub }>>
    let kubo: Controller
    let name: IPNS

    beforeEach(async () => {
      helia = await createHeliaNode({
        services: {
          identify: identifyService(),
          pubsub: gossipsub()
        }
      })
      kubo = await createKuboNode({
        args: ['--enable-pubsub-experiment', '--enable-namesys-pubsub']
      })

      // connect the two nodes
      await connect(helia, kubo, '/meshsub/1.1.0')

      name = ipns(helia, [
        pubsub(helia)
      ])
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

      const keyName = 'my-ipns-key'
      await helia.libp2p.keychain.createKey(keyName, keyType)
      const peerId = await helia.libp2p.keychain.exportPeerId(keyName)

      if (peerId.publicKey == null) {
        throw new Error('No public key present')
      }

      // first publish should fail because kubo isn't subscribed to key update channel
      await expect(name.publish(peerId, cid)).to.eventually.be.rejected()
        .with.property('message', 'PublishError.InsufficientPeers')

      // should fail to resolve the first time as kubo was not subscribed to the pubsub channel
      await expect(last(kubo.api.name.resolve(peerId, {
        timeout: 100
      }))).to.eventually.be.undefined()

      // magic pubsub subscription name
      const subscriptionName = `/ipns/${CID.createV1(LIBP2P_KEY_CODEC, identity.digest(peerId.publicKey)).toString(base36)}`

      // wait for kubo to be subscribed to updates
      await waitFor(async () => {
        const subs = await kubo.api.name.pubsub.subs()

        return subs.includes(subscriptionName)
      }, {
        timeout: 30000
      })

      // publish should now succeed
      await name.publish(peerId, cid)

      // kubo should now be able to resolve IPNS name
      const resolved = await last(kubo.api.name.resolve(peerId, {
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
      const peerId = await peerIdFromKeys(peerCid.multihash.digest)

      // first call to pubsub resolver should fail but we should now be subscribed for updates
      await expect(name.resolve(peerId)).to.eventually.be.rejected()

      // actual pubsub subscription name
      const subscriptionName = `/record/${uint8ArrayToString(uint8ArrayConcat([
        uint8ArrayFromString('/ipns/'),
        peerId.toBytes()
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

      let resolvedCid: CID | undefined

      // we should get an update eventually
      await waitFor(async () => {
        try {
          resolvedCid = await name.resolve(peerId)

          return true
        } catch {
          return false
        }
      }, {
        timeout: 10000,
        message: 'Helia could not resolve the IPNS record'
      })

      if (resolvedCid == null) {
        throw new Error('Failed to resolve CID')
      }

      expect(resolvedCid.toString()).to.equal(cid.toString())
    })
  })
})
