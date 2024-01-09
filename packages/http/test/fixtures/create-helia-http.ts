import { trustlessGateway } from '@helia/block-brokers'
import { createHeliaHTTP as createNode } from '../../src/index.js'
import type { HeliaHTTP } from '@helia/interface/http'

export async function createHeliaHTTP (): Promise<HeliaHTTP> {
  return createNode({
    blockBrokers: [
      trustlessGateway()
    ]
  })
}
