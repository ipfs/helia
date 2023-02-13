import type { Libp2p } from '@libp2p/interface-libp2p'
import type { Bitswap } from 'ipfs-bitswap'

interface StartComponents {
  bitswap: Bitswap
  libp2p: Libp2p
}

export function createStart (components: StartComponents) {
  return async function start (): Promise<void> {
    components.bitswap.start()
    await components.libp2p.start()
  }
}
