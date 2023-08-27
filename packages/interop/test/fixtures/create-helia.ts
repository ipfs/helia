import { createHelia } from 'helia'
import type { Helia } from '@helia/interface'

export async function createHeliaNode (): Promise<Helia> {
  const helia = await createHelia()

  return helia
}
