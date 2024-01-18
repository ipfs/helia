import { logger } from '@libp2p/logger'
import { UnixFS } from 'ipfs-unixfs'

const log = logger('helia:verified-fetch:transform-streams:unixfs')

export const getUnixFsTransformStream = (): TransformStream<Uint8Array, Uint8Array> => new TransformStream({
  async transform (chunk, controller) {
    try {
      const unmarshalled = UnixFS.unmarshal(chunk)
      controller.enqueue(unmarshalled.data)
    } catch (e) {
      log.error(e)
      // unmarshalling failed, so just pass the chunk through
      controller.enqueue(chunk)
    }
  }
})
