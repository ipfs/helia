import { createHeliaHTTP as createHelia } from '@helia/http'
import type { HeliaHTTPInit } from '@helia/http'
import type { Helia } from '@helia/interface'

export async function createHeliaHTTP (init: Partial<HeliaHTTPInit> = {}): Promise<Helia> {
  return createHelia({
    ...init
  })
}
