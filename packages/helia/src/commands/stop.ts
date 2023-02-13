import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Bitswap } from 'ipfs-bitswap'

interface StopComponents {
  bitswap: Bitswap
  libp2p: Libp2p
}

export function createStop (components: StopComponents) {
  return async function stop (): Promise<void> {
    components.bitswap.stop()
    await components.libp2p.stop()
  }
}
