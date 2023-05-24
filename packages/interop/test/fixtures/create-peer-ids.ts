import all from 'it-all'
import map from 'it-map'
import { sha256 } from 'multiformats/hashes/sha2'
import { compare as uint8ArrayCompare } from 'uint8arrays/compare'
import { xor as uint8ArrayXor } from 'uint8arrays/xor'
import type { PeerId } from '@libp2p/interface-peer-id'

/**
 * Sort peers by distance to the KadID of the passed buffer
 */
export async function sortClosestPeers (buf: Uint8Array, peers: PeerId[]): Promise<PeerId[]> {
  const kadId = await convertBuffer(buf)

  const distances = await all(
    map(peers, async (peer) => {
      const id = await convertPeerId(peer)

      return {
        peer,
        distance: uint8ArrayXor(id, kadId)
      }
    })
  )

  return distances
    .sort((a, b) => {
      return uint8ArrayCompare(a.distance, b.distance)
    })
    .map((d) => d.peer)
}

/**
 * Creates a DHT ID by hashing a Peer ID
 */
export async function convertPeerId (peerId: PeerId): Promise<Uint8Array> {
  return convertBuffer(peerId.toBytes())
}

/**
 * Creates a DHT ID by hashing a given Uint8Array
 */
export async function convertBuffer (buf: Uint8Array): Promise<Uint8Array> {
  const multihash = await sha256.digest(buf)

  return multihash.digest
}
