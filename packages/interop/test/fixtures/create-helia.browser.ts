import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { createHelia } from 'helia'
import type { Helia } from '@helia/interface'

export async function createHeliaNode (): Promise<Helia> {
  const helia = await createHelia({
    libp2p: {
      addresses: {
        listen: []
      },
      transports: [
        webSockets({
          filter: all
        })
      ],
      connectionGater: {
        denyDialMultiaddr: async () => false
      }
    }
  })

  return helia
}
