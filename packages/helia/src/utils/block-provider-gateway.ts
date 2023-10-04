import { logger } from '@libp2p/logger'
import { getRawBlockFromGateway } from './get-raw-block-from-gateway.js'
import type { BlockProvider } from '@helia/interface/blocks'
import type { CID } from 'multiformats/cid'

const log = logger('helia:gateway-block-provider')
export function getGatewayBlockProvider (url: URL | string): BlockProvider {
  const blockProvider: BlockProvider = {
    get: async (cid: CID, options = {}) => {
      log('getting block for %s from %s', cid.toString(), url.toString())
      try {
        const block = await getRawBlockFromGateway(url, cid, options.signal)
        log('got block for %s from %s', cid.toString(), url.toString())

        return block
      } catch (err) {
        log.error('failed to get block for %s from %s', cid.toString(), url.toString(), err)

        throw err
      }
    }
  }

  return blockProvider
}
