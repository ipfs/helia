import { expect } from 'aegir/chai'
import type { Helia } from 'helia'
import type { KuboNode } from 'ipfsd-ctl'

/**
 * Connect the two nodes by dialing a protocol stream
 */
export async function connect (helia: Helia<any>, kubo: KuboNode, protocol: string): Promise<void> {
  let connected = false
  const id = await kubo.api.id()

  for (const addr of id.addresses) {
    try {
      await helia.libp2p.dialProtocol(addr, protocol)
      connected = true
      break
    } catch { }
  }

  expect(connected).to.be.true('could not connect Helia to Kubo')
}
