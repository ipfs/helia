import { expect } from 'aegir/chai'
import type { HeliaLibp2p } from 'helia'
import type { Controller } from 'ipfsd-ctl'

/**
 * Connect the two nodes by dialing a protocol stream
 */
export async function connect (helia: HeliaLibp2p<any>, kubo: Controller, protocol: string): Promise<void> {
  let connected = false
  for (const addr of kubo.peer.addresses) {
    try {
      await helia.libp2p.dialProtocol(addr, protocol)
      connected = true
      break
    } catch { }
  }

  expect(connected).to.be.true('could not connect Helia to Kubo')
}
